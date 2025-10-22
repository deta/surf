const { spawn } = require('child_process')

const env = {
  HUSKY: '0',
  NODE_OPTIONS: '--max_old_space_size=8192',

  PRODUCT_NAME: 'Surf',
  M_VITE_PRODUCT_NAME: 'Surf',
  BUILD_RESOURCES_DIR: 'build/resources/prod'
}

spawn('yarn', [`build:desktop:${process.argv[2]}`], {
  env: { ...process.env, ...env },
  shell: true,
  stdio: 'inherit'
})
