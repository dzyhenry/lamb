node {
  stage('build') {
    sh "npm install"
  }
  stage('test') {
    sh "npm test"
  }
}
