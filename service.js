'use strict';

exports = module.exports = {};

let _ = require('lodash');

let mongo = require('./mongo');
let utils = require('./utils');
let config = require('./config');
let data = require('./data.json');


exports.attack = async function (message, sender) {
  let messageList = message.split(' ').filter(el => el);
  let attacker;
  let damage;
  if (messageList.length === 1) {
    attacker = sender;
    damage = Math.floor(Number(messageList[0]));
  } else if (messageList.length === 2) {
    attacker = messageList[0].match(/^\[CQ:at,qq=([0-9]+)\]$/);
    if (!attacker) return;
    attacker = { user_id: attacker[1], group_id: sender.group_id };
    damage = Math.floor(Number(messageList[1]));
  } else {
    return;
  }
  if (isNaN(damage)) return;
  if (damage < 0) return;

  let bossInfo = await utils.getBoss(attacker.group_id);
  let eff = data.eff[bossInfo.round > data.eff.length ? data.eff.length - 1 : bossInfo.round - 1][bossInfo.number - 1];
  if (damage > bossInfo.hp) return `boss只剩${bossInfo.hp}血, 尾刀请分开报.`;
  let type = bossInfo.hp === damage ? 'tailAttack' : 'member';

  await mongo.Damage.insertOne({
    user_id: attacker.user_id,
    group_id: attacker.group_id,
    type: type,
    damage: damage,
    point: eff * damage,
    date: new Date(),
  });
  bossInfo = await utils.getBoss(attacker.group_id);

  if (type === 'tailAttack') await utils.checkTree(attacker.group_id);

  return `${messageList.length === 2 ? `帮${messageList[0]}` : ''}${type === 'tailAttack' ? '尾刀' : '出刀'}完成 当前boss: ${bossInfo.round}周目${bossInfo.number}王 剩余${bossInfo.hp}血.`
}

exports.onTree = async function (message, sender) {
  if (message) return;
  let bossInfo = await utils.getBoss(sender.group_id);

  await mongo.TempData.insertOne({
    type: 'team_onTree',
    date: new Date(),
    data: {
      group_id: sender.group_id,
      user_id: sender.user_id,
      ...bossInfo,
    }
  });
  return 'ok, 等boss没了我群里@你.'
}

exports.startTeamFight = async function (message, sender) {
  if (message) return;
  if (!await utils.isAdmin(sender.group_id, sender.user_id)) return;

  await mongo.TempData.insertOne({
    type: 'team_time',
    date: new Date(),
    data: {
      group_id: sender.group_id,
    },
  });

  return 'ok';
}

exports.who = async function (message, sender) {
  let messageList = message.split(' ').filter(el => el);
  if (messageList.length > 1) return;
  let role = utils.whoIs(messageList[0]);
  if (role) return `${role.mainName} (${role.jpName})`;
  return;
}

exports.inputBox = async function (message, sender) {
  let roleMessageList = message.split(' ').filter(el => el);

  try {
    let roleList = utils.getRoleListByRoleMessage(roleMessageList.join(' '));
    roleList = roleList.map(role => ({ id: role.id, star: role.star }));
    let userInfo = await utils.findOrCreateGroupUser(sender.group_id, sender.user_id);
    await mongo.User.updateOne({ _id: userInfo._id }, { $set: { roleList } });

    return 'ok';
  } catch (err) {
    return err.message;
  }
}

exports.getBox = async function (message, sender) {
  if (message) return;
  let userInfo = await mongo.User.findOne({ group_id: sender.group_id, user_id: sender.user_id });

  if (!userInfo.roleList) return;

  let roleIdList = userInfo.roleList.map(userRole => userRole.id);
  let roleList = utils.getRoleByRoleIdList(roleIdList);

  userInfo.roleList = userInfo.roleList.map(userRole => {
    let role = roleList.find(role => role.id === userRole.id);
    role.star = userRole.star;
    return role;
  });

  return userInfo.roleList.map(userRole => `${userRole.star}星${userRole.mainName}`).join(' ');
}

exports.help = async function (message, sender) {
  let routes = require('./route');

  let messageArray = message.split(/[ \.\n\t:;；]/g).filter(el => el);
  let opt = Object.keys(routes).filter(routeName => {
    if (routeName === 'codeMap') return false;

    // 给入参数则强行按参数查询
    if (messageArray.length) {
      return messageArray.includes(routeName);
    }
    // 无参数则默认显示全部
    return !routes[routeName].invisible;
  }).map(routeName => {
    return `${routeName}(${routes[routeName].alise.join(', ')}): ${routes[routeName].label}`;
  });

  return '\n' + opt.join('\n');
}
