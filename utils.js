exports = module.exports = {};

let mongo = require('./mongo');
let config = require('./config');
let data = require('./data.json');
let roleData = require('./role');
let agent = require('superagent');
let _ = require('lodash');

const getCommand = (text) => {
  let command = text.split(' ');
  command.shift();

  return command.join(' ');
}
exports.getCommand = getCommand;

//#region coolq http api

const sendMessage = async (messageBody) => {
  let agentRes = await agent.post(`${config.coolq.host}:${config.coolq.port}/send_msg`).send(messageBody);
  if (agentRes.body.status !== 'ok') {
    console.error(`发送消息给 ${messageBody.user_id} 失败.`)
    let newError = new Error();
    error.resp = agentRes.body;
    error.resp.user_id = messageBody.user_id;
    error.resp.group_id = messageBody.group_id;
    throw newError;
  }
}
exports.sendMessage = sendMessage;

const getGroupList = async () => {
  let agentRes = await agent.get(`${config.coolq.host}:${config.coolq.port}/get_group_list`);
  if (agentRes.body.status !== 'ok') {
    console.error(agentRes.body);
  }
  return agentRes.body.data;
}
exports.getGroupList = getGroupList;

const setGroupCard = async (groupId, userId, card) => {
  let agentRes = await agent
    .post(`${config.coolq.host}:${config.coolq.port}/set_group_card`)
    .send({
      group_id: groupId,
      user_id: userId,
      card: card,
    });
  if (agentRes.body.status !== 'ok') {
    console.error(agentRes.body);
  }
  return agentRes.body.data;
}
exports.setGroupCard = setGroupCard;

const getGroupUserList = async (groupId) => {
  let agentRes = await agent
    .get(`${config.coolq.host}:${config.coolq.port}/get_group_member_list`)
    .query({
      group_id: groupId,
    });
  if (agentRes.body.status !== 'ok') {
    console.error('获取群员列表失败.', agentRes.body);
  }
  agentRes.body.data = agentRes.body.data.filter(el => el.user_id !== config.botId);
  return agentRes.body.data;
}
exports.getGroupUserList = getGroupUserList;

const getGroupUserInfo = async (groupId, userId) => {
  let agentRes = await agent
    .get(`${config.coolq.host}:${config.coolq.port}/get_group_member_info`)
    .query({
      group_id: groupId,
      user_id: userId,
      no_cache: true,
    });
  if (agentRes.body.status !== 'ok') {
    console.error('获取群员信息失败.', agentRes.body);
    return null;
  }
  return agentRes.body.data;
}
exports.getGroupUserInfo = getGroupUserInfo;

const leaveGroup = async (groupId) => {
  con
  let agentRes = await agent.post(`${config.coolq.host}:${config.coolq.port}/set_group_leave`).send({
    group_id: groupId,
  });
  if (agentRes.body.status !== 'ok') {
    console.error(agentRes.body);
  }
}
exports.leaveGroup = leaveGroup;

//#endregion

//#region service utils

let findOrCreateGroupUser = async (groupId, userId) => {
  let userInfo = await mongo.User.findOne({
    group_id: groupId,
    user_id: userId,
  });
  if (!userInfo) {
    let tempInfo = await getGroupUserInfo(groupId, userId);
    await mongo.User.insertOne(tempInfo);
    return findOrCreateGroupUser(groupId, userId);
  }
  return userInfo;
}
exports.findOrCreateGroupUser = findOrCreateGroupUser;

let setGroupAdmin = async (groupId, userId, status) => {
  let memberInfo = await findOrCreateGroupUser(groupId, userId);
  await mongo.User.updateOne(
    { group_id: groupId, user_id: userId },
    { $set: { isAdmin: status } }
  )
}
exports.setGroupAdmin = setGroupAdmin;

let syncGroupAdmin = async () => {
  let groupList = await getGroupList();
  for (let group of groupList) {
    let groupUserList = await getGroupUserList(group.group_id);
    for (let groupUser of groupUserList) {
      await setGroupAdmin(group.group_id, groupUser.user_id, groupUser.role === 'admin' || groupUser.role === 'owner');
    }
  }
}
exports.syncGroupAdmin = syncGroupAdmin;

let isAdmin = async (groupId, userId) => {
  if (config.adminIdList.includes(userId)) return true;
  let userInfo = await mongo.User.findOne({ group_id: groupId, user_id: userId });
  return !!userInfo.isAdmin;
}
exports.isAdmin = isAdmin;

let getTeamFightTime = async (groupId) => {
  let teamTime = await mongo.TempData.find({
    type: 'team_time',
    "data.group_id": groupId,
  }).sort({ date: -1 }).limit(1).toArray();
  if (!teamTime.length) throw new Error('工会战尚未开始.');

  let startTime = teamTime[0].date;
  let endTime = new Date(startTime);
  endTime.setDate(endTime.getDate() + 8);

  return { startTime, endTime };
}
exports.getTeamFightTime = getTeamFightTime;

let getBossNumber = (hpList, damage) => {
  let hpSum = _.sum(hpList);
  if (damage >= hpSum) throw new Error('伤害溢出');
  let number = 0;
  while (damage >= 0) {
    damage -= hpList[number++];
  }

  return {
    number: number,
    hp: -damage || 0,
  }
}

let getGroupDamage = async (groupId) => {
  let { startTime, endTime } = await getTeamFightTime(groupId);

  let damageList = await mongo.Damage.find({
    date: {
      $gte: startTime,
      $lte: endTime,
    },
    group_id: groupId,
  }).toArray();

  let sumDamage = 0;
  let damageObject;
  while (damageObject = damageList.pop()) {
    sumDamage += damageObject.damage;
    if (damageObject.type === 'admin') break;
  };

  return sumDamage;
}

let getBoss = async (groupId) => {
  let sumDamage = await getGroupDamage(groupId);
  let lastRoundSum = _.sum(data.boss[data.boss.length - 1]);

  let opt = {};

  let dataSum = _.sum(data.boss.map(roundData => _.sum(roundData)));
  if (sumDamage >= dataSum) {
    opt.round = Math.floor((sumDamage - dataSum) / lastRoundSum) + data.boss.length + 1;
    return Object.assign(opt, getBossNumber(
      data.boss[data.boss.length - 1],
      sumDamage - dataSum - (opt.round - 1 - data.boss.length) * lastRoundSum
    ))
  }

  opt.round = 1;
  while (1) {
    let nowRoundSum = _.sum(data.boss[opt.round - 1]);
    if (sumDamage >= nowRoundSum) sumDamage -= nowRoundSum;
    else return Object.assign(opt, getBossNumber(data.boss[opt.round - 1], sumDamage));
    opt.round++;
  }
}
exports.getBoss = getBoss;

let getBossDamage = (round, number, hp) => {
  let sumDamage = 0;
  let dataSum = _.sum(data.boss.map(roundData => _.sum(roundData)));
  let lastRoundData = data.boss[data.boss.length - 1];
  let lastRoundSum = _.sum(lastRoundData);
  if (round > data.boss.length) {
    let lastRound = round - 1 - data.boss.length;
    sumDamage = dataSum + lastRoundSum * lastRound;
    sumDamage += _.sum(lastRoundData.slice(0, number - 1))
    sumDamage += lastRoundData[number - 1] - hp;
    return sumDamage;
  }

  sumDamage += _.sum(data.boss.slice(0, round - 1).map(_.sum));
  sumDamage += _.sum(lastRoundData.slice(0, number - 1))
  sumDamage += data.boss[round - 1][number - 1] - hp;
  return sumDamage;
}

let setBoss = async (groupId, round, number, hp) => {
  let damage = getBossDamage(round, number, hp);

  return await mongo.Damage.insertOne({
    type: 'admin',
    date: new Date(),
    group_id: groupId,
    damage,
    point: 0,
  });
}
exports.setBoss = setBoss;

let checkTree = async (groupId) => {
  let bossInfo = await getBoss(groupId);
  let { startTime, endTime } = await getTeamFightTime(groupId);

  let tree = await mongo.TempData.find({
    type: 'team_onTree',
    date: { $gte: startTime, $lte: endTime },
    "data.group_id": groupId,
  }).toArray();

  let treeMember = [];
  for (let treeData of tree) {
    if (treeData.data.number !== bossInfo.number || treeData.data.round !== bossInfo.round) {
      treeMember.push(treeData.data.user_id);
    }
  };

  await mongo.TempData.deleteMany({
    type: 'team_onTree',
    date: { $gte: startTime, $lte: endTime },
    "data.group_id": groupId,
  });
  treeMember = Array.from(new Set(treeMember));
  if (treeMember.length) {
    await sendMessage({
      message_type: 'group',
      message: `${treeMember.map(user => `[CQ:at,qq=${user}]`).join(' ')} boss已死. 可以下树了.`,
      group_id: groupId,
    })
  }
}
exports.checkTree = checkTree;

let checkAttack = async (groupId, userId) => {
  let startToday = new Date()
  if (startToday.getHours() < 5) startToday.setDate(startToday.getDate() - 1);
  startToday.setHours(5);
  startToday.setMinutes(0);
  startToday.setSeconds(0);
  startToday.setMilliseconds(0);
  let endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);

  let damageList = await mongo.Damage.find({
    user_id: attacker.user_id,
    group_id: attacker.group_id,
    type: 'member',
    date: {
      $gte: startToday,
      $lte: endToday,
    },
  }).toArray();
}
exports.checkAttack = checkAttack;

let whoIs = (nickname) => {
  let role = roleData.find(role => role.nicknames.includes(nickname));
  if (!role) return;
  return _.cloneDeep(role);
}
exports.whoIs = whoIs;

let getRoleByRoleIdList = (roleIdList) => {
  return roleIdList.map(id => {
    let role = roleData.find(role => role.id === id);
    if (!role) throw new Error('roleId 不存在');
    return _.cloneDeep(role);
  });
}
exports.getRoleByRoleIdList = getRoleByRoleIdList;

let getRoleListByRoleMessage = (message) => {
  let roleMessageList = message.split(' ').filter(el => el);

  let errorList = [];
  let roleList = [];
  for (let roleMessage of roleMessageList) {
    let star = roleMessage.match(/([0-9]+)[\*星]/);
    if (!star) { errorList.push({ data: roleMessage, reason: '星级数据有误' }); continue; }
    star = Math.floor(Number(star[1]));
    if (isNaN(star) || star < 0) { errorList.push({ data: roleMessage, reason: '星级数据有误' }); continue; }

    let role = roleMessage.match(/[0-9]+[\*星](.+)/);
    if (!role) role = roleMessage.match(/(.+)[0-9]+[\*星]/);
    if (!role) { errorList.push({ data: roleMessage, reason: '没有录入角色' }); continue; }
    role = role[1];
    role = whoIs(role);
    if (!role) { errorList.push({ data: roleMessage, reason: '找不到这个角色' }); continue; }
    role.star = star;
    roleList.push(role);
  }

  if (errorList.length) throw new Error(errorList.map(error => error.data + ' ' + error.reason).join('\n'));
  return roleList;
}
exports.getRoleListByRoleMessage = getRoleListByRoleMessage;

//#endregion

//#region utils

const strPossible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const haxPossible = 'abcdef0123456789';

/**
 * 构建一个随机字符串
 *
 * @param {Number} length 字符串长度
 */
function createRandomString(length = 10, flag = {}) {
  let possible = strPossible;
  if (flag.hax) possible = haxPossible;
  return Array(length).fill(0).map(i => possible.charAt(Math.floor(possible.length * Math.random()))).join('');
}
exports.createRandomString = createRandomString;

function sleep(millisecond) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, millisecond);
  })
}
exports.sleep = sleep;

function replaceChinese(message) {
  message = message.replace(/一/g, '1');
  message = message.replace(/二/g, '2');
  message = message.replace(/三/g, '3');
  message = message.replace(/四/g, '4');
  message = message.replace(/五/g, '5');
  message = message.replace(/六/g, '6');
  message = message.replace(/七/g, '7');
  message = message.replace(/八/g, '8');
  message = message.replace(/九/g, '9');
  message = message.replace(/十/g, '10');
  message = message.replace(/([0-9]+)[\.]{0,1}([0-9]*)w/g, (r, $1, $2) => $1 + $2.padEnd(4, '0'));
  message = message.replace(/([0-9]+)[\.]{0,1}([0-9]*)k/g, (r, $1, $2) => $1 + $2.padEnd(3, '0'));
  message = message.replace(/([0-9]+)[\.]{0,1}([0-9]*)m/g, (r, $1, $2) => $1 + $2.padEnd(6, '0'));

  return message;
}
exports.replaceChinese = replaceChinese;

//#endregion
