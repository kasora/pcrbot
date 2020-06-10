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
    damage = Math.floor(Number(utils.replaceChinese(messageList[0])));
  } else if (messageList.length === 2) {
    attacker = messageList[0].match(/^\[CQ:at,qq=([0-9]+)\]$/);
    if (!attacker) return;
    attacker = { user_id: attacker[1], group_id: sender.group_id };
    damage = Math.floor(Number(utils.replaceChinese(messageList[1])));
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

exports.addHomework = async function (message, sender) {
  let messageList = message.split('\n').filter(el => el).map(el => el.split(' ').filter(el => el).join(' '));

  if (messageList.length < 3) return;
  let baseInfo = messageList[0];
  let roleListMessage = messageList[1];
  let timeline = messageList.slice(2);

  let baseInfoList = baseInfo.split(' ');
  let homeworkBody = {
    boss: {},
    date: new Date(),
    timeline: timeline.join('\n'),
    submittedBy: sender.user_id,
    group_id: sender.group_id,
  };

  if (baseInfoList.length !== 3) return '基础信息格式错误, 请输入 help 上传轴 参照其中的格式进行提交';
  let teamTime = await utils.getTeamFightTime(sender.group_id);
  let homework = await mongo.Homework.findOne({
    group_id: sender.group_id,
    date: { $gte: teamTime.startTime, $lte: teamTime.endTime },
    name: baseInfoList[0],
  });
  if (homework) return `已存在名为 ${baseInfoList[0]} 的轴`;
  homeworkBody.name = baseInfoList[0];

  baseInfoList[1] = utils.replaceChinese(baseInfoList[1]);
  let bossInfo = baseInfoList[1].match(/^([0-9]+)阶段(.*)([0-9]+)王$/);
  if (!bossInfo) return 'boss 信息不全, 请输入 help 上传轴 参照其中的格式进行提交'
  homeworkBody.boss.stage = Number(bossInfo[1]);
  homeworkBody.boss.type = bossInfo[2] ? bossInfo[2] : '普通';
  homeworkBody.boss.number = Number(bossInfo[3]);

  baseInfoList[2] = utils.replaceChinese(baseInfoList[2]);
  let damageInfo = baseInfoList[2].split('-').map(damage => Math.floor(Number(damage)));
  if (damageInfo.length !== 2 || damageInfo.find(damage => isNaN(damage))) return '伤害数值格式错误.'
  damageInfo = damageInfo.sort((a, b) => a - b);
  homeworkBody.minDamage = damageInfo[0];
  homeworkBody.maxDamage = damageInfo[1];

  try {
    let roleList = utils.getRoleListByRoleMessage(roleListMessage);
    if (roleList.length !== 5) return '阵容错误.'
    homeworkBody.roleList = roleList.map(el => ({ star: el.star, roleId: el.id }));
  } catch (err) {
    return err.message;
  }

  await mongo.Homework.insertOne(homeworkBody);

  return `${homeworkBody.boss.type}形态${homeworkBody.boss.stage}阶段${homeworkBody.boss.number}王轴 ${homeworkBody.name} 已成功上传.`
}

exports.getHomework = async function (message, sender) {
  let messageList = message.split(' ').filter(el => el);

  if (messageList.length !== 1) return;
  let teamTime = await utils.getTeamFightTime(sender.group_id);
  let homeworkInfo = await mongo.Homework.findOne({
    date: {
      $gte: teamTime.startTime,
      $lte: teamTime.endTime,
    },
    group_id: sender.group_id,
    name: messageList[0],
  });
  if (!homeworkInfo) return;

  let roleInfoList = utils.getRoleByRoleIdList(homeworkInfo.roleList.map(role => role.roleId));
  let roleList = homeworkInfo.roleList.map(role => {
    let tempRole = roleInfoList.find(info => info.id === role.roleId);
    tempRole.star = role.star;
    return tempRole;
  });

  let roleString = roleList.map(userRole => `${userRole.star}星${userRole.mainName}`).join(' ');

  return '\n' + [
    `${homeworkInfo.name} ${homeworkInfo.boss.stage}阶段${homeworkInfo.boss.type}${homeworkInfo.boss.number}王 ${homeworkInfo.minDamage}-${homeworkInfo.maxDamage}`,
    roleString,
    homeworkInfo.timeline,
  ].join('\n');
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
