'use strict';

exports = module.exports = {};

let mongo = require('./mongo');
let config = require('./config');

exports.acceptGroupInvite = async function (req, res) {
  // let groupList = await mongo.WhiteList.find({ type: 'group', id: req.body.group_id }).toArray();
  // if (groupList.length) {
  res.send({ approve: true });
  console.log(`拒绝加入群 ${req.body.group_id}.`)
  // } else {
  //   res.send({
  //     approve: false,
  //     reason: `如需添加我请先和 ${config.adminIdList.join(' 或者 ')} 联系。`
  //   });
  // }
}

exports.acceptFriendInvite = async function (req, res) {
  // let friendList = await mongo.WhiteList.find({ type: 'friend', id: req.body.user_id }).toArray();
  // if (friendList.length) {
  res.send({ approve: true });
  console.log(`拒绝了 ${req.body.user_id} 的好友请求.`)
  // } else {
  // res.send({ approve: false });
  // }
}
