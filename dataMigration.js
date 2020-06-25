'use strict';

let fs = require('fs');

let mongo = require('./mongo');

let compareVersion = (a, b) => {
  a = a.split('.');
  b = b.split('.');

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    let diff = Number(a[i]) - Number(b[i]);
    if (diff) return diff;
  }

  return 0;
}

let migration = async () => {
  await mongo.prepare();

  let current_version;
  try {
    current_version = fs.readFileSync('./current_version').toString();
  } catch (err) {
    current_version = require('./package.json').version || '0.0.0';
  }

  let todoList = scriptList.filter(script => compareVersion(script.version, current_version) > 0);
  for (let todoItem of todoList) {
    await todoItem.script();
    console.log(`脚本: ${todoItem.description} 已执行完毕.`)
  }

  console.log('所有脚本都已执行完毕.')
  process.exit();
}
migration();

//#region 待执行的叫本列表

let damage_user_id_to_number = async () => {
  let damageList = await mongo.Damage.find({}).toArray();

  for (let damage of damageList) {
    if (typeof (damage.user_id) === 'string') {
      await mongo.Damage.updateOne({ _id: damage._id }, { $set: { user_id: Number(damage.user_id) } });
    }
  }
}

//#endregion

let scriptList = [
  {
    version: '1.1.0',
    description: 'damage 表 user_id 格式错误',
    script: damage_user_id_to_number,
  }
]