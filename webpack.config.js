module.exports = {
  output: {
    library: "disputatio",
  },
  module: {
    rules: [
      {
        test: /leader-line\.min\.js$/,
        use: [ 'script-loader' ]
      }
    ]
  }
}
