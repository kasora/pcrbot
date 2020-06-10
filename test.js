let nickname = require('./role');
let fs = require('fs');

let roleList = []
Object.keys(nickname).forEach(key => {
  nickname[key].nicknames = nickname[key].nicknames.filter(el => el);
  nickname[key].jpName = nickname[key].mainName.match(/^.*\((.*)\)$/)[1];
  nickname[key].mainName = `${nickname[key].nicknames[0]}`;
  nickname[key].id = key;
  roleList.push(nickname[key])
})
fs.writeFileSync('./role.json', JSON.stringify(roleList, null, 2))
