const { spawn } = require('child_process')

const env = {
  // APP_VERSION: ${{ inputs.app_version }}
  // M_VITE_APP_VERSION: ${{ env.APP_VERSION }}
  // R_VITE_APP_VERSION: ${{ env.APP_VERSION }}

  HUSKY: '0',
  NODE_OPTIONS: '--max_old_space_size=8192',

  PRODUCT_NAME: 'Surf',
  M_VITE_PRODUCT_NAME: 'Surf',
  BUILD_RESOURCES_DIR: 'build/resources/prod',

  // APPLE_ID: ${{ secrets.APPLE_ID }}
  // APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  // APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
  // CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
  // CSC_LINK: ${{ secrets.CSC_LINK }}

  // R_VITE_CHEATSHEET_URL: ${{ secrets.CHEATSHEET_URL_BASE }}/${{ inputs.APP_VERSION }}
  // R_VITE_FEEDBACK_URL: ${{ secrets.FEEDBACK_PAGE_URL }}

  R_VITE_TELEMETRY_API_KEY: '',
  P_VITE_OPEN_AI_API_ENDPOINT: 'https://deta.space/api/v0/deta-os-ai/openai',
  P_VITE_VISION_API_ENDPOINT: 'https://deta.space/api/v0/deta-os-ai/vision',
  P_VITE_API_BASE: 'https://deta.space/api',
  M_VITE_API_BASE: 'https://deta.space/api'

  // AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  // AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  // S3_UPDATES_BUCKET_NAME: ${{ secrets.S3_UPDATES_BUCKET_NAME }}
  // S3_UPDATES_BUCKET_REGION: ${{ secrets.S3_UPDATES_BUCKET_REGION }}
  // SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
}

spawn('yarn', [`build:desktop:${process.argv[2]}`], {
  env: { ...process.env, ...env },
  shell: true,
  stdio: 'inherit'
})
