sudo docker container stop qqbot-pcr
sudo docker run -ti --rm -d --name qqbot-pcr \
             -v $(pwd)/coolq:/home/user/coolq \
             -p 9000:9000 \
             -p 5700:5700 \
             -e CQHTTP_POST_URL=http://qq-bot.lan:9229 \
             -e CQHTTP_SERVE_DATA_FILES=yes \
             # 如果购买了 coolq pro, 取消下面的注释以获得更好的bot体验
             #-e COOLQ_URL=http://dlsec.cqp.me/cqp-full \
             richardchien/cqhttp:latest
