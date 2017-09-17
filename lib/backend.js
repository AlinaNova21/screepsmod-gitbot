const YAML = require('yamljs')
const path = require('path')
const crypto = require('crypto')
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request-promise').defaults({
  headers: { 'user-agent': 'Screepsmod-gitbot' },
  json: true
})

const authroute = require(path.join(path.dirname(require.main.filename), '../lib/game/api/auth'))

const router = new express.Router()

let db, env

module.exports = function(config){
  db = config.common.storage.db
  config.backend.on('expressPreConfig', (app) => {
    app.use(router)
  })
  router.use('/gitbot', express.static(`${__dirname}/../static`))
  router.post('/api/gitbot/secret', authroute.tokenAuth, bodyParser.json(), ({ body: { secret }, user: { _id } }, res) => {
    db.users.update({ _id }, { $set: { gitbotSecret: secret }})
  })
  router.post('/api/gitbot/webhook', getUser, (req, res, next) => {
    let data = ''
    req.on('data', d => data += d.toString())
    req.on('end', () => {
      req.raw = data
      req.body = JSON.parse(data)
      next()
    })
  }, (req, res, next) => {
    const sig = req.get('x-hub-signature')
    const { gitbotSecret } = req.user
    const hmac = crypto.createHmac('sha1', gitbotSecret)
    hmac.update(req.raw)
    const hash = 'sha1=' + hmac.digest('hex')
    console.log('Gitbot webhook',req.get('x-github-event'),req.get('x-hub-signature'),hash,req.query)
    if (sig != hash) return res.status(500).end('Signature Mismatch')
    res.json({ ok: 1 })
    const repoBranch = req.query.branch || 'master'
    switch(req.get('x-github-event')) {
      case 'pull_request':
        if(req.body.action == 'closed' && req.body.pull_request.merged) {
          let repo = body.base.repo.full_name
          let branch = body.base.ref
          if(branch != repoBranch) return
          deploy(req, repo, branch)
        }
        break
      case 'push':
        {
          let repo = req.body.repository.full_name
          let branch = req.body.ref.split('/')[2]
          if(branch != repoBranch) return
          deploy(req, repo, branch)
        }
        break
      default:
        break
    }
  })
}

function getUser(req, res, next) {
  let { username } = req.query
  if (!username) return next('No username supplied')
  db.users.findOne({ username })
    .then(user => {
      if (!user) return next('No user found')
      req.user = user
      next()
    })
    
}

function deploy(req, repo, ref) {
  const { user, body } = req
  console.log('Deploy', user.username, repo)
  return request.get(`https://api.github.com/repos/${repo}/contents?ref=${ref}`)
    .then(contents => {
      let configFile = contents.find(file => file.name == '.gitbot.yaml')
      if (configFile) {
        return getConfig(configFile.url)
      }
      throw new Error('No Config')
    })
    .then(({ directory, branch, badge } = {}) => {
      return getCode(repo, ref, directory)
        .then(modules => {
          let timestamp = new Date().getTime()
          db['users.code'].update({ user: user._id, branch }, { $set: { branch, modules, timestamp }}, { upsert: true })
          if (badge) {
            db.users.update({ _id: user._id }, { $set: { badge } })
          }
        })      
    })
    .catch(err => {
      console.error('Gitbot',user.username, repo, ref, err)
    })
}

function getCode(repo, ref, directory) {
  return request.get(`https://api.github.com/repos/${repo}/contents/${directory}?ref=${ref}`)
    .then(files => Promise.all(files.filter((f) => f.type == 'file' ).map(file => request.get(file.url))))
    .then(files => {
      let ret = {}
      files.forEach(({ name, content }) => {
        name = name.replace(/.js$/, '')
        content = new Buffer(content, 'base64')
        ret[name] = content
      })
      return ret
    })
}

function getConfig(configURL){
  return request.get(configURL)
    .then(({ content }) => {
      const yaml = new Buffer(content, 'base64').toString()
      return YAML.parse(yaml)
    })
}

function log(data){
  console.log(data)
  return data
}