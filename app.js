'use strict'

let Express = require('express');
let fs = require('fs');

let utils = require('./utils');
let config = require('./config');
let routes = require('./route');
let mongo = require('./mongo');
let handler = require('./handler');
let notification = require('./notification');

let app = new Express();

app.use(Express.json())

app.use('/', async (req, res, next) => {
  await mongo.prepare();
  next();
});

app.use('/', async (req, res, next) => {
  // 消息处理
  if (req.body.post_type === 'message') {
    // bot 不接受私聊
    if (req.body.message_type === 'private') return res.send({});
    req.body.sender.group_id = req.body.group_id;

    let routeNameList = Object.keys(routes.codeMap).sort((a, b) => b.length - a.length);
    for (let routeName of routeNameList) {
      let handler = routes.codeMap[routeName];
      // 不分大小写
      routeName = routeName.toLocaleLowerCase();

      // 判断是命令还是吹水
      if (req.body.message.toLocaleLowerCase().startsWith(routeName)) {
        console.log(`${req.body.sender.nickname}: ${req.body.message}`);

        let message = req.body.message.split('\n');
        message[0] = message[0].toLocaleLowerCase().match(new RegExp(`^${routeName}(.*)`))[1];
        message = message.join('\n');

        let sender = req.body.sender;

        let output;
        try {
          output = await handler(message, sender);
          if (output) return res.send({ at_sender: true, reply: output });
          else return res.send({});
        } catch (err) {
          console.error(err);
          // return res.send({ at_sender: true, reply: `执行错误. 联系管理员查看日志.` });
        }
      }
    };
  }

  // 请求处理
  if (req.body.post_type === 'request') {
    if (req.body.request_type === 'group' && req.body.sub_type === 'invite') {
      return await handler.acceptGroupInvite(req, res);
    }

    if (req.body.request_type === 'friend') {
      return await handler.acceptFriendInvite(req, res);
    }
  }

  if (req.body.post_type === 'notice') {
    if (req.body.notice_type === 'group_admin') {
      await utils.setGroupAdmin(req.body.group_id, req.body.user_id, req.body.sub_type === 'set');
    }
    if (req.body.notice_type === 'group_increase') {
      await utils.findOrCreateGroupUser(req.body.group_id, req.body.user_id);
    }
  }

  return res.send({ status: 'ok' });
})

async function init() {
  await mongo.prepare();

  let version = require('./package.json').version;
  fs.writeFileSync('./current_version', version);
  process.env.version = version

  await utils.syncGroupAdmin();
  await notification.sendNews();
}
init();

setInterval(async () => {
  await mongo.prepare();

  await notification.sendNews();
}, 1000 * 60 * 5)

app.listen(config.listenPort, function () {
  console.log(`Listening on port ${config.listenPort} now!`);
});


// {
//   font: 1611312,
//   message: 'hello',
//   message_id: 123,
//   message_type: 'private',
//   post_type: 'message',
//   raw_message: 'hello',
//   self_id: 123123123,
//   sender:
//   {
//     age: 88,
//     nickname: '123123',
//     sex: 'male',
//     user_id: 123123123,
//   },
//   sub_type: 'friend',
//   time: 123123123,
//   user_id: 123123123
// }
