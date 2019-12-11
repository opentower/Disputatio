module.exports = {
  resolve: {
      alias: {
          plain_draggable: "plain-draggable/plain-draggable.min.js"
      }
  },
  module: {
    rules: [
      {
        test: /leader-line\.min\.js$/,
        use: [ 'script-loader' ]
      },
      {
        test: /plain-draggable\.min\.js$/,
        use: [ 'script-loader' ]
      }
    ]
  }
}
