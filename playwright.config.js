const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'runtime_tests',testMatch:'*.spec.js',workers:1,use:{launchOptions:{executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']}}});
