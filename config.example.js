exports = module.exports = {
  coolq: {
    host: 'localhost', // 这里填的是 coolq-http-api 部署的机器 ip 或域名
    port: 5800, // 这里填的是 coolq-http-api 部署的端口
  },

  mongo: { // 保存一些成员信息
    host: 'database', // 这里填的是部署 mongoDB 的机器 ip 或域名
    databaseName: 'pcr',
    username: '',
    password: '',
    port: '27017',
  },

  listenPort: 9229, // 本项目的监听端口，coolq-http-api 的事件推送端口
  adminIdList: [
    222233333,
  ], // 这里填的是额外管理员的 qq 号，支持多个管理员，允许管理员使用管理命令。
  notification: {
    ignoreRegExpList: [
      /恭喜@.*中奖/,
      /四格漫画更新/,
      /互动抽奖/
    ],
    rssHubUrl: 'https://rsshub.app', // 感谢 RssHub 提供的新闻推送数据
  }
}