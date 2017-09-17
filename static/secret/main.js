(function () {
  const app = angular.module('screepsmod-gitbot', []) // jshint-ignore-line no-undef
  class GitBot {
    constructor ($window, API) {
      this.token = ''
      $window.addEventListener('message', (e) => {
        let data = JSON.parse(e.data)
        API.setToken(data.token)
        this.setSecret(this.secret)
      })
    }
    setSecret (secret) {
      this.status = 'Setting secret...'
      return API.gitbot(this.secret)
        .then((res) => {
          if (res.ok) {
            this.status = 'Secret secret set!'
          } else {
            this.status = `Secret set attempt failed! ${res.error}`
          }
        })
    }
    steam () {
      return true
    }
    signin (username, password) {
      return API.signIn(username, password)
        .then(({ token }) => {
          API.setToken(data.token)
          return this.setSecret(this.secret)
        })
    }
  }
  class API {
    constructor ($http) {
      this.$http = $http
    }
    req (method, url, data = {}) {
      let params = {}
      if (method === 'GET') {
        params = data
        data = null
      }
      let headers = {
        'X-Token': this.token,
        'X-Username': this.token
      }
      return this.$http({ method, url, params, data, headers })
        .then(res => res.data)
        .catch(res => res.data)
    }
    setToken (token) {
      this.token = token
    }
    gitbot (secret) {
      return this.req('POST', '/api/gitbot/secret', { secret })
    }
    signIn (username, password) {
      return this.req('POST', '/api/auth/signin', { username, password })
    }
  }
  app.controller('gitbot', GitBot)
  app.service('API', API)
})()
