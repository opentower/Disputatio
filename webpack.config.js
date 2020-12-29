module.exports = {
  output: {
    library: "Disputatio",
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
