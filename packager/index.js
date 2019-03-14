const fs = require('fs')
const path = require('path')
const promisify = require('util').promisify

const nanoid = require('nanoid/non-secure')
const rimraf = promisify(require('rimraf'))
const webpack = promisify(require('webpack'))
const unzip = promisify(require('extract-zip'))
const zip = promisify(require('deterministic-zip'))

const shim_generator = require('./shim')

const SHIM_FILE_NAME = '_cloudflare_shim.js'

const ensureDir = (dir) => {
  console.log({ dir })
  if (!fs.existsSync(dir)) {
    console.log(`creating: ${dir}`)
    fs.mkdirSync(dir)
  }
}

const unzip_fab = async (fab_file, work_dir) => {
  await ensureDir(work_dir)
  await unzip(fab_file, { dir: path.resolve(work_dir) })
}

const generateWorker = async (work_dir, output_dir, assets_base_url) => {
  const shim = shim_generator(assets_base_url)
  const shim_path = path.join(work_dir, SHIM_FILE_NAME)
  fs.writeFileSync(shim_path, shim)
  const stats = await webpack({
    mode: 'production',
    target: 'webworker',
    entry: shim_path,
    optimization: {
      minimize: false,
    },
    output: {
      path: output_dir,
      filename: 'worker.js',
    },
    node: {
      path: true,
      process: true,
      net: 'empty',
    },
  })
  const errors = stats.compilation.errors
  if (errors.length > 0) {
    console.log({ errors })
    throw new Error(`Error running webpack: ${errors}`)
  }
  return path.join(output_dir, 'worker.js')
}

const zipAssets = async (output_dir, work_dir) => {
  const zipfile = path.join(output_dir, 'assets.zip')
  await zip(work_dir, zipfile, { includes: ['./_assets/**'], cwd: work_dir })
}

const package = async (fab_file, output_dir, options) => {
  if (!options || !options.assets_base_url) {
    throw new Error('options.assets_base_url needs to be set')
  }
  output_dir = path.resolve(output_dir)
  await ensureDir(output_dir)
  const work_dir = path.join(output_dir, nanoid())
  try {
    await unzip_fab(fab_file, work_dir)
    await generateWorker(work_dir, output_dir, options.assets_base_url)
    await zipAssets(output_dir, work_dir)
  } finally {
    await rimraf(work_dir, { glob: { cwd: output_dir } })
  }
}

module.exports = package
