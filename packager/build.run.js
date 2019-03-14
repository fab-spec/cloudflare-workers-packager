const packager = require('./index')

packager('./test-data/linc-demo.zip', './dist', {
  assets_base_url: 'https://static-assets.linc.sh',
})
