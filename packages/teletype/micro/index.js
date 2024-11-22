const express = require('express')
const path = require('path')

const app = express()

app.use(express.static(path.join(__dirname, './dist')))

if (require.main === module) {
  try {
    const PORT = process.env.PORT || 3000

    app.listen(PORT, () => console.log(`Listening at ${PORT}`))
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

module.exports = app
