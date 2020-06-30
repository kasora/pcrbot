'use strict';

const { MongoClient } = require('mongodb');

// 获取数据库相关的静态数据
const config = require('./config');

let _db = null;

/**
 * 连接到数据库，并将连接保存到 _db 中
 * 
 * @returns {Promise<MongoClient>} 生成 mongoClient 的 promise
 */
let mongoConnect = async () => {
  try {
    let { host, port, username, password, databaseName } = config.mongo;
    let linkUrl = `mongodb://${host}:${port}/`;
    /* istanbul ignore next */
    if (username && password) {
      linkUrl = `mongodb://${username}:${password}@${host}:${port}/${databaseName}`;
    }
    _db = (await MongoClient.connect(linkUrl, { useNewUrlParser: true, useUnifiedTopology: true })).db(databaseName);

    // 绑定快捷路径
    exports.User = _db.collection('user');
    exports.TempData = _db.collection('tempData');
    exports.Homework = _db.collection('homework');
    exports.FightHistory = _db.collection('fightHistory');
    exports.attackQuery = _db.collection('attackQuery');
    exports.Damage = _db.collection('damage');
    exports.Group = _db.collection('group');

    return _db;
  } catch (err) {
    /* istanbul ignore next */
    console.error(err);
    /* istanbul ignore next */
    process.exit(10);
  }
};
let connection = mongoConnect();

/**
 * 一个 Promise
 * 数据库连接完成后会被 resolve
 *
 * @returns {Promise<Null>} 无意义
 */
let prepare = async () => {
  /* istanbul ignore else */
  if (!_db) await connection;
};

exports = module.exports = {
  get client() {
    return _db;
  },

  prepare: prepare,
};

/** User
group_id 群号
user_id QQ 号
nickname 昵称
card 群名片／备注
sex 性别，male / female / unknown
age 年龄
area 地区
join_time 加群时间戳
last_sent_time 最后发言时间戳
level 成员等级
role 角色，owner 或 admin 或 member
unfriendly 是否不良记录成员
title 专属头衔
title_expire_time 专属头衔过期时间戳
card_changeable 是否允许修改群名片
isAdmin 是否为管理员
isTeamMember 是否为工会成员(出刀/挂树 会使此人自动变为当前工会成员)
*/

/* Damage
type // admin: 管理设定血量 member: 成员下刀血量 tailAttack: 尾刀
date // 伤害时间
user_id
group_id
damage
point
bossInfo: {
  stage
  type
  round
  number
  hp
}
*/

/* TempData
type // team_time: 工会战开始 team_onTree: 挂树 news: 新闻更新
date
data
*/

/** FightHistory
date // 战绩上传时间
winRoleList Array<id> // 胜利方阵容
loseRoleList Array<id> // 失败方阵容
*/

/* Homework
date
timeline
boss: {
  number
  stage
  type // 普通 狂暴
}
roleList:[
  id
  star
]
name
maxDamage
minDamage
submittedBy
group_id
*/

/* Group
group_id
needNotification true: 需要新闻推送
*/