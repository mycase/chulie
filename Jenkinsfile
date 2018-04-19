@Library('mc_jenkins_lib@v3.4.0') _ //load-bearing underscore

pipeline {
  agent none
  environment {
    APP_NAME = 'sokoban.js'
  }
  options {
    ansiColor('xterm')
  }
  stages {
    stage('Setup'){
      steps{
        script {
          env.BUILD_TIMESTAMP = getBuildTimestamp()
        } // script
      } // steps
    } // stage('Setup')
    stage('Build and run tests') {
      steps{
        node('docker && basic') {
          checkout scm
          script {
            env.GIT_COMMIT_SHA = sh (script: "git log -n 1 --pretty=format:'%H'", returnStdout: true)
            env.IMAGE_NAME="${env.APP_NAME}:${env.GIT_COMMIT_SHA}"
            sh "docker-compose -f docker-compose.ci.yml build"
            try {
              sh "docker-compose -f docker-compose.ci.yml run --name=$GIT_COMMIT_SHA test"
            } finally {
              try {
                sh "rm -rf test_reports && mkdir test_reports && docker cp $GIT_COMMIT_SHA:/app/test/reports.xml test_reports/"
                archive 'test_reports/**/*'
                junit 'test_reports/**/*.xml'
              } finally {
                sh "docker-compose -f docker-compose.ci.yml down"
              }
            }
          }
          deleteDir()
        }
      }
    }
    stage('Release') {
      when {
        branch 'master'
      }
      steps {
        node('basic') {
          checkout scm
          script {
            // This only create a release tag for now,
            // may or may not do the auto packing and publishing thing.
            releaseTag = "release_${env.BUILD_TIMESTAMP}"
            publishGitTag([
              org: 'appfolio',
              repo: env.APP_NAME,
              tagName: releaseTag,
              tagMessage: "${env.APP_NAME} ${env.BRANCH_NAME}#${env.BUILD_ID}"
            ])
          } // script
          deleteDir()
        } // node
      } // steps
    } // stage('Release')
  } // stages
} // pipeline
