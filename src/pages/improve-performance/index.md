---
title: 页面加载性能优化
date: "2018-06-28T21:46:37.121Z"
tags: ["性能"]
---

前阵子应聘了十来家公司，“页面性能优化”相关问题被三成公司问及了。起初答得似是而非，便去查漏补缺，最后变成了我才答到一半，面试官就说“好了好了 可以了。。。”233。<br/>
然知道自己的理解还不够准确具体，故占个坑来总结下。<br/>
ps. 参考了不少网络资料，相关出处见文章结尾的“参考资料”。

## 引子：页面从输入url到加载完显示出来
要理解如何优化页面加载性能，首先要知道“在页面加载的过程中，经历了哪些步骤”。简单说包括:
- DNS解析
- TCP连接、发送HTTP请求
- 服务器处理请求并响应
- 浏览器解析渲染页面
- 连接结束

接着针对性去想优化方案即可。

## DNS解析优化
DNS解析实现了url到IP地址的转换。优化方案有：
- DNS缓存。从先到后为浏览器缓存、客户端系统缓存、路由器缓存、IPS服务器缓存、根域名服务器缓存、顶级域名服务器缓存、主域名服务器缓存。<br/>
    - Time To Live（TTL）表示DNS记录在DNS服务器（或其ISP）上的缓存时间。我们要尽可能直接ISP缓存中拿到A记录，省却向域名服务器递归查找，但也要保障服务器出问题时能尽快切换。具体是：在服务器有备份的情况下，TTL越短越能保障宕机时能及时切换。否则若没备份，就可以设置TTL时间越长越好。
    - 巧用CNAME（别名）。把所有小网站域名/二级域名，cname到一个自己定义的统一域名。可以加热第二级 & 缓存时间足够长的第一级，来最大化优化DNS解析时间，具体是：（1）给这个cname设置足够长的TTL值，保证网站的第一次解析可直接从运营商的DNS缓存中拿到。（2）给第二个cname记录设置一个相对合理的TTL值，变相加热了第二级域名。
    - 另外可以寻求比较热的域名解析商，被访问次数越多，缓存的域名就多，也就不推荐自己做一个域名解析服务器。
- prefetch<br/>
域名解析和内容载入是串行的网络操作，prefetch能减少用户的等待时间，提升用户体验。<br/>
可以通过meta信息告诉浏览器页面需要DNS预解析。<br/>
 `<meta http-equiv="x-dns-prefetch-control" content="on" />`<br/>
然后通过 link 标签强制 DNS 预解析。<br/>
 `<link rel="dns-prefetch" href="http://hm.baidu.com" />`<br/>
注：多页面出现重复的dns-prefetch会增加重复DNS查询次数。
- DNS负载均衡<br/>
DNS负载均衡可以照顾到每台机器的负载量、该机器离用户地理位置的距离（以降低延迟）等。<br/>
CDN(Content Delivery Network)借助了DNS的重定向技术：由DNS服务器返回离用户最近的IP地址给用户、而CDN节点服务器负责响应用户的请求，提供所需内容。
- 域名收敛 or 域名发散<br/>
域名收敛指采用尽可能少的域名，以减少DNS解析的开销，产生于LDNS缓存技术出现前的移动互联网时代。<br/>
与之对应的是域名发散：因浏览器有域名并发请求限制（如chrome为6个），故使用域名发散策略，将http静态资源放入多个域名/子域名中，以保证资源更快加载。<br/>
事实上，结合CDN来拆分域名比合并域名更常用，比如按页面类（html、htm）、样式类（js、css）、图片类（jpg、png、gif）、动态类（php、asp）等来分。[天猫首页](https://www.tmall.com)一进去就有百来个接口请求，就拆有g.alicdn.com/img.alicdn.com/at.alicdn.com等。
- HttpDNS<br/>
如果DNS解析出现问题，首屏渲染就会严重受阻。
将DNS这种容易被劫持的协议（基于UDP协议），转而使用HTTP协议请求Domain与IP地址之间的映射，就不用担心ISP（互联网服务提供商）篡改数据了。
- 避免重定向，以减少DNS查询。

## TCP连接、HTTP请求优化
TCP三次握手，建立连接并发送数据。此阶段优化方案有：
- 并行请求。互不依赖的资源，可采用并行请求。
- 持久链接。Keep-Alive，指在一个TCP连接中可以持续发送多份数据而不会断开连接，以减少time-wait。
    - 客户端发出`connection：keep-alive`后，服务器如果同意就返回`connection：keep-alive`，同时可以限制HTTP连接的数量、指定在多久后关闭。如服务器返回：`connection：keep-alive; keep-alive: max=5,timeout=120`表示最多有5个http请求保持此tcp连接处于打开状态，维持2分钟。
    - 由HTTP1.0引入、HTTP1.1之后默认开启。而在HTTP2中，Connection & Keep-Alive会被忽略，HTTP2中Connection有别的含义。
    - 优点：避免缓慢的握手连接和慢启动的拥塞适应阶段，以便快速传输数据，缺点：长时间占用socket。
- 合并资源/减少请求数。绕过最大并行请求数限制 & 减少握手消耗。
    - 雪碧图（Spriting），将小图合并成一张大图，缺点：某些页面只需显示几个小图，却要请求那么大size的大图。
    - 内联（Inline），图片通过Data URI的方式内置在HTML或者CSS里，作用是减少请求数，如url(data:image/png;base64,<data>) no-repeat。缺点同上。
    - 拼接（Concatenation）接口，合并http请求。缺点：接口的一个小改动会造成大量数据的重新下载。
- 控制资源体积
    - 压缩去注释
    - gzip：服务端开启gzip压缩。
    - 用iconfont代替小图标，更甚者可以通过阿里妈妈平台自制iconfont，来替代不能按需加载 & 体积较大的第三方字体库。
    - Webpack打包优化：压缩静态资源 & 按需加载 & 路由懒加载。
- 缓存优化
    - Cache：静态资源版本号+永久缓存是基本，动态/入口资源短时间缓存有积极作用。
    - Last-Modified & If-Modified-Since
        - 响应头中的Last-Modified标记了资源在服务端的最后修改时间。
        - 当客户端发现HTTP响应头中有Last-Modified，会对资源进行缓存，下次请求资源时在HTTP请求头中加上If-Modified-Since，其值为上次成功请求资源时响应头的Last-Modified值。
        - 当服务端接收到的HTTP请求中，发现有If-Modified-Since头部时，会将该属性值与请求资源的最后修改时间进行比对，一致则返回一个304 Not Modified响应（不包括响应实体），使浏览器重定向来获取本地缓存资源，不一致则会从服务端重新获取资源，做出200响应。
    - Etag & If-Match：ETag原理类似于Last-Modified & If-Modified-Since，只是并非以时间作为标记，而是对所请求文件进行某些算法来生成一串唯一的字符串，作为对某一文件的标记，客户端收到Etag后，下次请求会将其值作为If-None-Match请求头的值来请求后端。
    - Expires & cache-control：Expires告知浏览器缓存资源的过期时间，但存在服务器和客户端系统时间不一致的隐患，可以改用cache-control的max-age来指定多久后过期。如果响应头既有Expires和Cache-Control，浏览器首选Cache-Control。
    - Manifest：因浏览器实现问题基本无法使用，谨慎对待manifest文件缓存，避免死缓存。
    - localStorage。有限使用，注意体积上限。
- W3C的[Preload](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Preloading_content)，定义了一种通过响应头部尽早告诉浏览器需要加载哪些资源的方案。 
    - 如`<link rel="preload" href="/path/to/style.css" as="style">`，其中preload值让你可以在head标签内写一些声明式的资源获取请求，来指明哪些资源是在页面加载完成后即刻需要的，它们会在浏览器的主渲染机制介入前就进行预加载。
    - preload 将提升资源加载的优先级（可在network里查看），它不会阻塞windows的onload事件（除非，preload资源的请求刚好来自于会阻塞window加载的资源）。
    - 避免混用 preload 和 prefetch。
        - preload 是告诉浏览器页面必定需要的资源，浏览器一定会加载这些资源。
        - prefetch 是告诉浏览器页面可能需要的资源，浏览器不一定会加载这些资源。
        - 如果对用一资源preload & prefetch，会带来双倍的网络请求。
    
## 服务器处理请求并响应（这个议题交给后端同学）
服务器端会从硬盘中取出静态资源，放在响应主体中发送给客户端。而对于动态资源，服务器先取出资源，并通过业务逻辑操作，动态生成最终的响应主体发送给客户端。优化手段主要有缓存、集群、异步等。

## 浏览器解析渲染页面
客户端接受到服务器端传输过来的网络资源，然后进行渲染、绘制等，最终展示给用户。
具体步骤有：
- HTML解析出DOM Tree
- CSS解析出Style Rules
- 将二者关联生成Render Tree
- Layout 根据Render Tree计算每个节点的信息
- Painting 根据计算好的信息绘制整个页面

一般优化原则有：
- html
    - 文档结构层次尽量少，最好不深于六层；样式结构层次尽量简单。
    - 可使用Transfer-Encoding: chunk实现下载和解析并行（js/css不明）。
- css
    - 少量首屏样式内联放在标签内。
    - 写高效率的css，减少嵌套。
    - 动画尽量使用在绝对定位或固定定位的元素上；隐藏在屏幕外，或在页面滚动时，尽量停止动画。
- js
    - js放到body结束标签前面
    - defer和async
        - defer。表示延迟执行引入的js，即这段js加载时，html可以并行解析。整个document解析完毕且defer-script也加载完成之后，会执行所有由defer-script加载的js代码，然后触发DOMContentLoaded事件。
        - async：通知浏览器该脚本不需要在引用位置执行，这样浏览器就可以继续构建DOM，js会在就绪后开始执行。async与defer的区别在于：async-script如果已经加载好，就会开始执行，可能在DOMContentLoaded触发之前或之后、一定在load触发之前（即：会阻塞load事件）。
        - 注意async与defer属性对于 inline-script 都是无效的。
    - 尽量避免用js操作DOM/修改元素样式。
        - 查找器尽量简洁。
        - 尽量缓存访问DOM的样式信息，避免过度触发回流。
        - createFragment。遇到大量数据，可通过document.createfragment创建一个文档碎片，把所有新节点附加上去，再一次性添加到document中。
        - 尽量使用修改class名方式操作样式或动画；
- 骨架图。面对SPA首屏白屏时间过长，骨架图可作为”缓兵之计”。

## 添加性能监控（略）
最后可以添加性能监控，比如使用window.performance中Navigation.timing / 引入第三方监控库，来统计时耗信息，针对性地做优化。

## 参考资料
- [Web 性能优化-缓存-DNS 缓存](https://lz5z.com/Web%E6%80%A7%E8%83%BD%E4%BC%98%E5%8C%96-DNS%E7%BC%93%E5%AD%98/)