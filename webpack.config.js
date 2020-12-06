module.exports = {
  output: {
    library: "disputatio",
  },
  module: { 
      rules: [
          {
              test: /\.css$/i,
              use: ["css-loader"]
          }
      ] 
  }
}
