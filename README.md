# pcrbot
该项目旨在创建一个功能精简的 bot, 适用于小型工会使用.

## 功能
- 报刀: 记录伤害, boss 被击杀时会通知所有挂树玩家
- 挂树: 挂树, 等待救援
- 录入box: 录入 box , 方便计算当前 box 的最优解. 例如 `录入box 5星黑骑 偶像5* 4*空花`
- 我的box: 查看以录入的 box 
- 别名查询: 查看黑话对应的角色名 例如 `谁是xcw`. ( 感谢 [yobot](https://github.com/yuudi/yobot) 的数据 )

tips: 如果文档不匹配请使用 `help` 指令查看所有支持的指令

## 搭建
- 搭建 coolq-http-api 的环境。推荐使用 Docker。参照[这里](https://cqhttp.cc/docs/4.10/#/Docker)
- 根据你在 Docker 中传入的参数，对应的修改 `config.example.js`，并将其改名为 `config.js`
- 安装 MongoDB，请自行查询安装方式。并将 MongoDB 的参数给入 `config.js`
- `npm install`
- `npm start`
- 将你的 bot 拉入群，输入 `help` 查看是否正常运行

tips: `coolq` 可以参照 `docker_reboot.example.sh` 进行 docker 搭建

## 开源协议
LGPL-3.0