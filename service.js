'use strict';

exports = module.exports = {};

//#region 类型定义

/**
 * @typedef Sender 发送者
 * @property {Number} [age] 年龄
 * @property {String} nickname 昵称
 * @property {Number} user_id QQ 号
 * @property {Number} group_id 群号
 */

//#endregion

let _ = require('lodash');

let mongo = require('./mongo');
let utils = require('./utils');
let data = require('./data.json');

exports.attack = async function (message, sender) {
  let messageList = message.split(' ').filter(el => el);
  let attacker;
  let damage;
  if (messageList.length === 1) {
    attacker = sender;
    damage = Math.floor(Number(utils.replaceChinese(messageList[0])));
  } else if (messageList.length === 2) {
    attacker = messageList[0].match(/^\[cq:at,qq=([0-9]+)\]$/);
    if (!attacker) return;
    attacker = await mongo.User.findOne({ user_id: Number(attacker[1]), group_id: sender.group_id });
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
    bossInfo,
  });
  bossInfo = await utils.getBoss(attacker.group_id);

  // 尾刀时提醒挂树成员
  if (type === 'tailAttack') await utils.checkTree(attacker.group_id);

  // 将其自动置为工会成员
  await mongo.User.updateOne({ user_id: attacker.user_id, group_id: sender.group_id }, { $set: { isTeamMember: true } });

  return `${messageList.length === 2 ? `帮[CQ:at,qq=${attacker.user_id}]` : ''}${type === 'tailAttack' ? '尾刀' : '出刀'}完成 当前boss: ${bossInfo.round}周目${bossInfo.number}王 剩余${bossInfo.hp}血.`
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

  // 将其自动置为工会成员
  await mongo.User.updateOne({ user_id: sender.user_id, group_id: sender.group_id }, { $set: { isTeamMember: true } });

  return 'ok, 等boss没了我群里@你.'
}

exports.startTeamFight = async function (message, sender) {
  if (message) return;

  await mongo.TempData.insertOne({
    type: 'team_time',
    date: new Date(),
    data: {
      group_id: sender.group_id,
    },
  });

  return 'ok';
}

exports.dailyReport = async function (message, sender) {
  if (message) return;
  let attackList = await utils.checkAttack(sender.group_id);

  let attackObject = {};
  for (let attackInfo of attackList) {
    if (attackObject[attackInfo.user_id]) attackObject[attackInfo.user_id].push(attackInfo);
    else attackObject[attackInfo.user_id] = [attackInfo];
  }

  let attackInfoList = [];
  let userList = await mongo.User.find({ group_id: sender.group_id, isTeamMember: true }).toArray();
  if (!userList.length) return '尚无工会成员出刀';
  for (let user_id of Object.keys(attackObject)) {
    let userInfo = userList.find(el => el.user_id === Number(user_id));

    let dailyAttackInfo = {
      user_id: userInfo.user_id,
      username: userInfo.card || userInfo.nickname,
      memberAttackList: attackObject[user_id].filter(el => el.type === 'member'),
      tailAttackList: attackObject[user_id].filter(el => el.type === 'tailAttack'),
      point: attackObject[user_id].reduce((a, b) => a + b.point, 0),
      damage: attackObject[user_id].reduce((a, b) => a + b.damage, 0),
    }
    dailyAttackInfo.memberAttackTimes = dailyAttackInfo.memberAttackList.length;
    dailyAttackInfo.tailAttackTimes = dailyAttackInfo.tailAttackList.length;
    dailyAttackInfo.leftTimes = 3 - dailyAttackInfo.memberAttackTimes;

    attackInfoList.push(dailyAttackInfo)
  }

  return [
    `当前工会成员共有${userList.length}人`,
    ...attackInfoList.sort((a, b) => b.point - a.point).map(dailyAttackInfo => `${dailyAttackInfo.username}: ${dailyAttackInfo.memberAttackTimes}刀${dailyAttackInfo.tailAttackTimes ? `与${dailyAttackInfo.tailAttackTimes}刀尾刀` : ''} 共计伤害: ${dailyAttackInfo.damage} 共计得分: ${dailyAttackInfo.point}`),
    '以下成员没有出完今日的刀',
    ...userList.filter(user => {
      let attackInfo = attackInfoList.find(info => info.user_id === user.user_id);
      return !attackInfo || attackInfo.leftTimes;
    }).map(user => {
      let attackInfo = attackInfoList.find(info => info.user_id === user.user_id);
      return `[CQ:at,qq=${user.user_id}]: 剩余${attackInfo ? attackInfo.leftTimes : 3}刀`
    }),
  ].join('\n');
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

exports.getBoss = async function (message, sender) {
  if (message) return;
  let bossInfo = await utils.getBoss(sender.group_id);

  return `${bossInfo.stage}阶段${bossInfo.type === '狂暴' ? '狂暴' : ''} ${bossInfo.round}周目${bossInfo.number}王 剩余血量: ${bossInfo.hp}`;
}

exports.setBoss = async function (message, sender) {
  let { endTime } = await utils.getTeamFightTime(sender.group_id);
  if (new Date() > endTime) return '公会战已结束.'

  message = utils.replaceChinese(message).toLowerCase();

  let bossInfo = await utils.getBoss(sender.group_id);

  let regExpListObject = {
    round: [/([ 0-9]+)周目/],
    number: [/([ 0-9]+)王/, /([ 0-9]+)号boss/, /([ 0-9]+)号/],
    hp: [/剩余血量:([ 0-9]+)/, /剩余血量；([ 0-9]+)/, /血量；([ 0-9]+)/, /血量:([ 0-9]+)/, /血量([ 0-9]+)/, /剩余血量([ 0-9]+)/],
  }

  for (let key of Object.keys(regExpListObject)) {
    for (let regExp of regExpListObject[key]) {
      let tempValue = message.match(regExp);
      if (tempValue) bossInfo[key] = Number(tempValue[1]);
    }
  }

  await utils.setBoss(sender.group_id, bossInfo.round, bossInfo.number, bossInfo.hp);

  bossInfo = await utils.getBoss(sender.group_id);
  return `${bossInfo.stage}阶段${bossInfo.type === '狂暴' ? '狂暴' : ''} ${bossInfo.round}周目${bossInfo.number}王 剩余血量: ${bossInfo.hp}`;
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
  let messageList = message.split('\n').filter(el => el).map(el => el.split(/[\r\n ]/).filter(el => el).join(' '));

  if (messageList.length < 3) return;
  let baseInfo = messageList[0];
  let roleListMessage = utils.replaceChinese(messageList[1]);
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
  if (homework && (homework.submittedBy !== sender.user_id || homework.group_id !== sender.group_id)) return `已存在名为 ${baseInfoList[0]} 的轴`;
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
    homeworkBody.roleList = roleList.map(el => ({ star: el.star, id: el.id }));
  } catch (err) {
    return err.message;
  }
  if (homework) await mongo.Homework.deleteOne({ _id: homework._id });
  await mongo.Homework.insertOne(homeworkBody);

  return `${homeworkBody.boss.type}形态${homeworkBody.boss.stage}阶段${homeworkBody.boss.number}王轴 ${homeworkBody.name} 已成功${homework ? '替换' : '上传'}.`
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

  let roleInfoList = utils.getRoleByRoleIdList(homeworkInfo.roleList.map(role => role.id));
  let roleList = homeworkInfo.roleList.map(role => {
    let tempRole = roleInfoList.find(info => info.id === role.id);
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

exports.getMaxDamage = async function (message, sender) {
  let messageList = message.split(' ').filter(el => el);
  if (messageList.length > 2) return;

  let times = 3;
  let boss = await utils.getBoss(sender.group_id);
  boss = _.pick(boss, ['stage', 'number', 'type']);
  for (let message of messageList) {
    let tempString = utils.replaceChinese(message);
    let res = tempString.match(/^([0-3]{1})刀{0,1}$/);
    if (res) times = Number(res[1]);

    res = tempString.match(/^([0-9]+)阶段(.*)([0-9]+)王$/);
    if (res) {
      boss.stage = Number(res[1]);
      if (res[2]) boss.type = res[2];
      boss.number = Number(res[3]);
    }

    res = tempString.match(/^(.*)([0-9]+)阶段([0-9]+)王$/);
    if (res) {
      if (res[1]) boss.type = res[1];
      boss.stage = Number(res[2]);
      boss.number = Number(res[3]);
    }
  }

  let userInfo = await mongo.User.findOne({ group_id: sender.group_id, user_id: sender.user_id });
  let userBox = userInfo.roleList;
  if (!userBox || !userBox.length) return '先使用 录入box 命令录入你的box'

  let teamTime = await utils.getTeamFightTime(sender.group_id);
  let homeworkQuery = {
    date: {
      $gte: teamTime.startTime,
      $lte: teamTime.endTime,
    },
    group_id: sender.group_id,
  };
  for (let key of Object.keys(boss)) homeworkQuery[`boss.${key}`] = boss[key];
  let homeworkList = await mongo.Homework.find(homeworkQuery).toArray();

  let maxDamageObject = utils.getBoxMaxDamage(homeworkList, userBox, times);
  maxDamageObject.teamList = maxDamageObject.teamList.map(team => {
    let roleList = utils.getRoleByRoleIdList(team.map(role => role.id));
    roleList.forEach(role => role.isBorrow = team.find(teamRole => teamRole.id === role.id).isBorrow)

    return roleList.map(role => `${role.mainName}${role.isBorrow ? '(借)' : ''}`).join(' ');
  })

  if (!maxDamageObject.teamList.length) return `${boss.stage}阶段${boss.type === '狂暴' ? boss.type : ''}${boss.number}王暂时还没有作业可以抄..`;
  return [
    `${boss.stage}阶段${boss.type === '狂暴' ? boss.type : ''}${boss.number}王 推荐使用以下阵容 预估伤害为 (${maxDamageObject.minDamage}-${maxDamageObject.maxDamage})`
  ].concat(
    maxDamageObject.teamList.map((team, index) =>
      `${maxDamageObject.homeworkList[index].name}(${maxDamageObject.homeworkList[index].minDamage}-${maxDamageObject.homeworkList[index].maxDamage}): ${team}`
    ),
  ).join('\n');
}

exports.switchNotification = async function (message, sender) {
  if (message) return;

  let mode = await mongo.Group.findOne({ group_id: sender.group_id });
  await mongo.Group.updateOne(
    { group_id: sender.group_id },
    { $set: { needNotification: !mode.needNotification } }
  );

  return `活动新闻推送已${!mode.needNotification ? '开启' : '关闭'}`;
}

exports.help = async function (message, sender) {
  let routes = require('./route');

  let messageArray = message.split(/[ \.\n\t:;；]/g).filter(el => el);
  let opt = Object.keys(routes).filter(routeName => {
    if (routeName === 'codeMap') return false;

    // 给入参数则强行按参数查询
    if (messageArray.length) {
      for (let message of messageArray) {
        if (routeName === message || routes[routeName].alise.includes(message)) return true;
      }
      return false;
    }
    return true;

  }).map(routeName => {
    if (!messageArray.length) {
      return `${routes[routeName].alise[0]}: ${routes[routeName].label}`;
    } else {
      return `${routes[routeName].label} 例如:\n${routes[routeName].example.join('\n')}\n\n等效的别名有: ${routes[routeName].alise.join(', ')}`;
    }
  });

  if (opt.length) {
    if (!messageArray.length) return 'help+命令名可以查看对应的命令详情\n' + opt.join('\n') + `\n\n源码: https://github.com/kasora/pcrbot 欢迎 pr / issue.\n当前bot版本: ${process.env.version}`;
    return '\n' + opt.join('\n');
  }
  return;
}
