// ===== 熟語のデータ =====
// 1行に1つずつ「熟語|意味|例文|例文の訳」の形で書きます。
// 熟語の中の [ ] でかこんだ語が、「熟語の穴うめ」で空らんになる部分です。
// 「#1」「#2」「#3」の行は、その下の熟語が中1・中2・中3で習うことを表します。

const IDIOMS_TEXT = `
#1
get [up]|起きる|I get up at six every day.|私は毎日6時に起きます。
go [to] bed|ねる|I go to bed at ten.|私は10時にねます。
go to [school]|学校へ行く|I go to school by bus.|私はバスで学校へ行きます。
come [home]|帰宅する|My father comes home at seven.|父は7時に帰宅します。
look [at]|～を見る|Look at this picture.|この写真を見て。
listen [to]|～を聞く|I listen to music every day.|私は毎日音楽を聞きます。
talk [about]|～について話す|We talked about our dreams.|私たちは夢について話しました。
wait [for]|～を待つ|I'm waiting for my friend.|私は友達を待っています。
sit [down]|すわる|Please sit down.|どうぞすわってください。
stand [up]|立つ、立ち上がる|Stand up, please.|立ってください。
come [in]|入る|Come in, please.|どうぞ入ってください。
come [from]|～の出身である|I come from Japan.|私は日本の出身です。
live [in]|～に住んでいる|I live in Osaka.|私は大阪に住んでいます。
a lot [of]|たくさんの|I have a lot of books.|私はたくさんの本を持っています。
lots [of]|たくさんの|There are lots of people here.|ここにはたくさんの人がいます。
a [few]|少しの（数）|I have a few friends in Canada.|私はカナダに少し友達がいます。
a [little]|少しの（量）、少し|I can speak a little English.|私は英語を少し話せます。
at [home]|家で|I studied at home yesterday.|私はきのう家で勉強しました。
[in] the morning|午前中に、朝に|I run in the morning.|私は朝に走ります。
[at] night|夜に|I read books at night.|私は夜に本を読みます。
every [day]|毎日|I practice the piano every day.|私は毎日ピアノを練習します。
after [school]|放課後|Let's play tennis after school.|放課後テニスをしよう。
take a [picture]|写真をとる|Can I take a picture here?|ここで写真をとってもいいですか。
take a [bath]|ふろに入る|I take a bath before dinner.|私は夕食前にふろに入ります。
go [shopping]|買い物に行く|Let's go shopping on Sunday.|日曜日に買い物に行こう。
go [fishing]|つりに行く|We went fishing in the river.|私たちは川へつりに行きました。
want [to] ～|～したい|I want to be a doctor.|私は医者になりたいです。
like [to] ～|～するのが好きだ|I like to draw pictures.|私は絵をかくのが好きです。
how [many]|いくつ（数）|How many cats do you have?|ねこを何びき飼っていますか。
how [much]|いくら（値段）、どれくらい（量）|How much is this bag?|このかばんはいくらですか。
how [old]|何歳|How old is your sister?|あなたのお姉さんは何歳ですか。
how [about] ～?|～はどうですか|How about this one?|これはどうですか。
what [time]|何時|What time is it now?|今何時ですか。
excuse [me]|すみません、失礼ですが|Excuse me, where is the station?|すみません、駅はどこですか。
[of] course|もちろん|Of course, you can use my pen.|もちろん、私のペンを使っていいですよ。
thank you [for] ～|～をありがとう|Thank you for your help.|手伝ってくれてありがとう。
I [see].|なるほど、わかりました|I see. Thank you.|なるほど。ありがとう。
see you [later]|またあとで|See you later, Ken.|またあとでね、ケン。
over [there]|あそこに、向こうに|My house is over there.|私の家はあそこです。
in front [of]|～の前に|There is a park in front of my house.|私の家の前に公園があります。
next [to]|～のとなりに|The bank is next to the hospital.|銀行は病院のとなりです。
be good [at]|～が得意だ|She is good at tennis.|彼女はテニスが得意です。
help A [with] B|AのBを手伝う|Can you help me with my homework?|私の宿題を手伝ってくれますか。
look [like]|～のように見える、～に似ている|You look like your mother.|あなたはお母さんに似ていますね。
for [example]|たとえば|I like fruit, for example, apples.|私はくだもの、たとえばりんごが好きです。
each [other]|おたがい（に）|We help each other.|私たちはおたがいに助け合います。
right [now]|今すぐ、ちょうど今|I'm busy right now.|今ちょうどいそがしいです。
put [on]|～を着る、身につける|Put on your coat.|コートを着なさい。
take [off]|～をぬぐ、（飛行機が）離陸する|Take off your shoes here.|ここでくつをぬいでください。
turn [on]|（電気などを）つける|Please turn on the light.|電気をつけてください。
turn [off]|（電気などを）消す|Turn off the TV.|テレビを消しなさい。
have [fun]|楽しむ|We had fun at the party.|私たちはパーティーで楽しみました。
have a good [time]|楽しい時を過ごす|I had a good time in Kyoto.|私は京都で楽しい時を過ごしました。
be late [for]|～におくれる|Don't be late for school.|学校におくれないで。
go [back]|戻る、帰る|I want to go back to Japan.|私は日本に帰りたいです。
come [back]|戻ってくる|Please come back soon.|すぐに戻ってきてね。
clean [up]|きれいにそうじする|Let's clean up the room.|部屋をそうじしよう。
wake [up]|目を覚ます|I woke up at five.|私は5時に目を覚ましました。
hurry [up]|急ぐ|Hurry up, or you'll miss the bus.|急がないとバスに乗りおくれるよ。
look [around]|見回す|He looked around the room.|彼は部屋を見回しました。
these [days]|このごろ|I'm busy these days.|このごろ私はいそがしいです。
one [day]|ある日|One day, I met a cat.|ある日、私はねこに出会いました。
all [day]|一日中|It rained all day.|一日中雨が降りました。
very [much]|とても|I like it very much.|私はそれがとても好きです。
not [very] ～|あまり～ない|I'm not very hungry.|私はあまりおなかがすいていません。
[at] school|学校で|I eat lunch at school.|私は学校で昼食を食べます。
go [home]|家に帰る|Let's go home.|家に帰ろう。
get [to]|～に着く|How can I get to the station?|駅へはどう行けばいいですか。
#2
be going [to] ～|～するつもりだ|I'm going to visit Kyoto next week.|私は来週京都を訪れるつもりです。
have [to] ～|～しなければならない|I have to finish my homework.|私は宿題を終えなければなりません。
don't have [to] ～|～する必要はない|You don't have to hurry.|急ぐ必要はありません。
be [able] to ～|～できる|She will be able to swim soon.|彼女はすぐに泳げるようになるでしょう。
would [like] ～|～がほしい（ていねい）|I'd like some water.|水がほしいのですが。
would like [to] ～|～したい（ていねい）|I'd like to go with you.|あなたといっしょに行きたいです。
be interested [in]|～に興味がある|I'm interested in Japanese history.|私は日本の歴史に興味があります。
be afraid [of]|～をこわがる|My sister is afraid of dogs.|妹は犬をこわがります。
be famous [for]|～で有名だ|This town is famous for its hot springs.|この町は温泉で有名です。
be different [from]|～とちがう|My idea is different from yours.|私の考えはあなたのとちがいます。
be full [of]|～でいっぱいだ|The box is full of toys.|その箱はおもちゃでいっぱいです。
be kind [to]|～に親切だ|Be kind to old people.|お年寄りに親切にしなさい。
be ready [for]|～の準備ができている|Are you ready for the test?|テストの準備はできていますか。
be busy [with]|～でいそがしい|I'm busy with my homework.|私は宿題でいそがしいです。
be glad [to] ～|～してうれしい|I'm glad to see you.|あなたに会えてうれしいです。
be surprised [at]|～におどろく|I was surprised at the news.|私はその知らせにおどろきました。
look [forward] to|～を楽しみに待つ|I'm looking forward to the trip.|私は旅行を楽しみにしています。
look [after]|～の世話をする|I look after my little brother.|私は弟の世話をします。
look [for]|～を探す|I'm looking for my key.|私はかぎを探しています。
take [care] of|～の世話をする、～を大事にする|Take care of yourself.|お体を大事にしてね。
give [up]|あきらめる|Don't give up your dream.|夢をあきらめないで。
find [out]|～を見つけ出す、～とわかる|I found out the truth.|私は真実を知りました。
get [on]|（乗り物に）乗る|Let's get on the bus.|バスに乗ろう。
get [off]|（乗り物から）降りる|Get off the train at the next station.|次の駅で電車を降りてください。
grow [up]|大人になる、育つ|I grew up in Hokkaido.|私は北海道で育ちました。
think [of]|～のことを考える、～を思いつく|I often think of my grandmother.|私はよく祖母のことを考えます。
think [about]|～について考える|Let's think about the future.|将来について考えよう。
hear [about]|～について聞く|Did you hear about the accident?|その事故について聞きましたか。
hear [from]|～から便りがある|I heard from Tom yesterday.|きのうトムから連絡がありました。
speak [to]|～に話しかける|A girl spoke to me in English.|女の子が英語で私に話しかけてきました。
say [hello] to|～によろしく言う|Say hello to your family.|ご家族によろしく。
ask [for]|～を求める|He asked for help.|彼は助けを求めました。
agree [with]|～に賛成する|I agree with you.|私はあなたに賛成です。
arrive [at]|～に着く|We arrived at the station at nine.|私たちは9時に駅に着きました。
belong [to]|～に所属する|I belong to the tennis club.|私はテニス部に所属しています。
keep [on] ～ing|～し続ける|He kept on running.|彼は走り続けました。
stay [with]|～の家に泊まる|I stayed with my aunt.|私はおばの家に泊まりました。
make friends [with]|～と友達になる|I made friends with Emma.|私はエマと友達になりました。
make a [mistake]|まちがえる|Don't be afraid of making mistakes.|まちがえることをおそれないで。
make a [speech]|スピーチをする|I made a speech in English.|私は英語でスピーチをしました。
take a [walk]|散歩する|Let's take a walk in the park.|公園を散歩しよう。
take [part] in|～に参加する|I took part in the volunteer event.|私はボランティア活動に参加しました。
have a [cold]|かぜをひいている|I have a cold today.|私はきょうかぜをひいています。
catch a [cold]|かぜをひく|Don't catch a cold.|かぜをひかないでね。
do one's [best]|最善をつくす|I'll do my best.|私はベストをつくします。
[at] first|最初は|At first, I couldn't swim.|最初、私は泳げませんでした。
[at] last|ついに|At last, we got to the top.|ついに私たちは頂上に着きました。
[at] once|すぐに|Come here at once.|すぐにここに来なさい。
for the first [time]|初めて|I visited Tokyo for the first time.|私は初めて東京を訪れました。
for a [long] time|長い間|I have wanted this for a long time.|私は長い間これがほしかったのです。
for a [while]|しばらくの間|Let's rest for a while.|しばらく休もう。
[all] over the world|世界中で|English is spoken all over the world.|英語は世界中で話されています。
around the [world]|世界中で（を）|He traveled around the world.|彼は世界中を旅しました。
[both] A and B|AとBの両方|I like both dogs and cats.|私は犬とねこの両方が好きです。
either A [or] B|AかBのどちらか|You can have either tea or coffee.|紅茶かコーヒーのどちらかを飲めます。
[such] as ～|～のような|I like fruit such as apples and bananas.|私はりんごやバナナのようなくだものが好きです。
a [kind] of|一種の|This is a kind of fish.|これは魚の一種です。
a [piece] of|1つの、1枚の|I need a piece of paper.|紙が1枚必要です。
a [cup] of|カップ1杯の|I drank a cup of tea.|私は紅茶を1杯飲みました。
a [glass] of|コップ1杯の|Can I have a glass of water?|水を1杯もらえますか。
one [of] ～|～のうちの1つ（1人）|He is one of my best friends.|彼は私の親友の1人です。
some [of] ～|～のいくつか|Some of the students are from China.|生徒の何人かは中国出身です。
in the [future]|将来|I want to work abroad in the future.|私は将来海外で働きたいです。
on [time]|時間通りに|The train arrived on time.|電車は時間通りに着きました。
on the [way]|とちゅうで|I met Ken on the way to school.|私は学校へ行くとちゅうでケンに会いました。
on [foot]|歩いて|I go to school on foot.|私は歩いて学校へ行きます。
by the [way]|ところで|By the way, where are you from?|ところで、あなたはどこの出身ですか。
[because] of|～のために、～が原因で|The game was stopped because of the rain.|雨のために試合は中止されました。
far [from]|～から遠い|My house is far from the station.|私の家は駅から遠いです。
between A [and] B|AとBの間に|The shop is between the bank and the park.|その店は銀行と公園の間にあります。
from A [to] B|AからBまで|I work from Monday to Friday.|私は月曜から金曜まで働きます。
right [away]|すぐに|I'll call you right away.|すぐに電話します。
as ～ [as] …|…と同じくらい～|Ken is as tall as his father.|ケンはお父さんと同じくらい背が高いです。
more and [more]|ますます多くの|More and more people use smartphones.|ますます多くの人がスマホを使っています。
little by [little]|少しずつ|My English is getting better little by little.|私の英語は少しずつよくなっています。
come [true]|実現する|I hope your dream will come true.|あなたの夢が実現するといいですね。
go [abroad]|外国へ行く|I want to go abroad someday.|私はいつか外国へ行きたいです。
go [out]|外出する|Let's go out for dinner.|夕食を食べに出かけよう。
go [on]|続ける、続く|Please go on.|どうぞ続けてください。
run [away]|逃げる|The cat ran away.|ねこは逃げていきました。
pick [up]|拾い上げる、車でむかえに行く|I'll pick you up at the station.|駅に車でむかえに行きますね。
throw [away]|捨てる|Don't throw away the bottle.|そのびんを捨てないで。
write [to]|～に手紙を書く|I wrote to my friend in America.|私はアメリカの友達に手紙を書きました。
show A [around]|Aを案内する|I'll show you around my town.|私の町を案内します。
try [to] ～|～しようとする|I tried to open the door.|私はドアを開けようとしました。
Why don't [you] ～?|～してはどうですか|Why don't you join us?|私たちに加わってはどうですか。
Shall [we] ～?|（いっしょに）～しましょうか|Shall we dance?|おどりましょうか。
Will [you] ～?|～してくれませんか|Will you open the window?|窓を開けてくれませんか。
What's [wrong]?|どうしたの？|What's wrong? You look sad.|どうしたの？悲しそうだね。
That's [right].|その通りです。|That's right. Good job!|その通り。よくできました！
Here you [are].|はい、どうぞ。|Here you are. This is your ticket.|はい、どうぞ。これがあなたの切符です。
No [problem].|いいですよ、問題ないよ|No problem. I can help you.|いいですよ。手伝えますよ。
You're [welcome].|どういたしまして|"Thank you." "You're welcome."|「ありがとう」「どういたしまして」
Nice to [meet] you.|はじめまして|Nice to meet you, too.|こちらこそ、はじめまして。
#3
be [used] to ～ing|～に慣れている|I'm used to getting up early.|私は早起きに慣れています。
used [to] ～|以前はよく～した|I used to live in Kobe.|私は以前神戸に住んでいました。
be made [of]|～でできている（材料）|This desk is made of wood.|この机は木でできています。
be made [from]|～から作られる（原料）|Cheese is made from milk.|チーズは牛乳から作られます。
be known [to]|～に知られている|The song is known to everyone.|その歌はみんなに知られています。
be covered [with]|～におおわれている|The mountain is covered with snow.|その山は雪におおわれています。
be pleased [with]|～に満足している|My teacher was pleased with my work.|先生は私の作品に満足していました。
be worried [about]|～を心配している|I'm worried about the test.|私はテストのことが心配です。
be born [in]|～で生まれる|I was born in 2013.|私は2013年に生まれました。
be similar [to]|～に似ている|My bag is similar to yours.|私のかばんはあなたのに似ています。
be proud [of]|～を誇りに思う|I'm proud of my team.|私はチームを誇りに思います。
too ～ [to] …|…するには～すぎる|This box is too heavy to carry.|この箱は重すぎて運べません。
～ enough [to] …|…するのに十分～|He is old enough to drive.|彼は運転できる年齢です。
so ～ [that] …|とても～なので…|I was so tired that I went to bed early.|とてもつかれていたので早くねました。
It is ～ for A [to] …|Aが…するのは～だ|It is easy for me to swim.|私にとって泳ぐことは簡単です。
ask A [to] …|Aに…するようたのむ|I asked him to help me.|私は彼に手伝ってくれるようたのみました。
tell A [to] …|Aに…するように言う|My mother told me to study.|母は私に勉強するように言いました。
want A [to] …|Aに…してほしい|I want you to come to the party.|あなたにパーティーに来てほしいです。
how [to] ～|～のしかた|Please tell me how to use this.|これの使い方を教えてください。
what [to] do|何をすべきか|I don't know what to do.|私は何をすべきかわかりません。
as soon [as] ～|～するとすぐに|Call me as soon as you get home.|家に着いたらすぐに電話してね。
[thanks] to|～のおかげで|Thanks to you, I passed the test.|あなたのおかげでテストに合格しました。
instead [of]|～の代わりに|I drank tea instead of coffee.|私はコーヒーの代わりに紅茶を飲みました。
in [order] to|～するために|I study hard in order to pass the exam.|私は試験に合格するために一生けんめい勉強します。
according [to]|～によれば|According to the news, it will snow.|ニュースによれば雪が降るそうです。
[thousands] of|何千もの|Thousands of people came to the festival.|何千もの人がその祭りに来ました。
[hundreds] of|何百もの|There are hundreds of books here.|ここには何百もの本があります。
a [number] of|多くの|A number of students joined the event.|多くの生徒がその行事に参加しました。
a [couple] of|2、3の|I'll be back in a couple of days.|2、3日で戻ります。
[no] longer|もはや～ない|He no longer lives here.|彼はもうここには住んでいません。
not ～ [at] all|まったく～ない|I'm not tired at all.|私はまったくつかれていません。
[at] least|少なくとも|I read at least one book a week.|私は週に少なくとも1冊本を読みます。
[at] the same time|同時に|They started at the same time.|彼らは同時にスタートしました。
[after] all|結局|After all, he didn't come.|結局、彼は来ませんでした。
[in] fact|実際は|In fact, I don't like it.|実は、私はそれが好きではありません。
[in] the end|最後には|In the end, we won the game.|最後には私たちが試合に勝ちました。
[by] oneself|ひとりで|She went there by herself.|彼女はひとりでそこへ行きました。
[in] those days|当時は|In those days, there were no phones.|当時は電話がありませんでした。
[on] the other hand|一方では|On the other hand, it is expensive.|一方で、それは高価です。
[as] a result|その結果|As a result, we won.|その結果、私たちは勝ちました。
side by [side]|並んで|We walked side by side.|私たちは並んで歩きました。
more [than]|～より多い|More than 100 people came.|100人以上の人が来ました。
take [place]|行われる、起こる|The festival takes place in July.|その祭りは7月に行われます。
come [up] with|～を思いつく|She came up with a good idea.|彼女はよい考えを思いつきました。
get [along] with|～と仲良くやる|I get along with my classmates.|私はクラスメイトと仲良くしています。
make [sure]|確かめる|Make sure the door is locked.|ドアにかぎがかかっているか確かめて。
make a [difference]|変化をもたらす、重要である|Small actions can make a difference.|小さな行動が変化をもたらすことがあります。
make a [decision]|決める|I made a decision to study abroad.|私は留学することに決めました。
pay [attention] to|～に注意を払う|Pay attention to the teacher.|先生の話をよく聞きなさい。
put [off]|延期する|We put off the game until Sunday.|私たちは試合を日曜日まで延期しました。
set [up]|設立する、準備する|They set up a new company.|彼らは新しい会社を設立しました。
depend [on]|～しだいである、～に頼る|It depends on the weather.|それは天気しだいです。
care [about]|～を気にかける|He cares about the environment.|彼は環境のことを気にかけています。
cut [down]|切り倒す|Many trees were cut down.|たくさんの木が切り倒されました。
run [out] of|～を使い果たす|We ran out of water.|私たちは水を使い果たしました。
look [up]|（辞書などで）調べる|Look up the word in your dictionary.|その単語を辞書で調べなさい。
deal [with]|～を扱う、対処する|We must deal with this problem.|私たちはこの問題に対処しなければなりません。
work [on]|～に取り組む|I'm working on my report.|私はレポートに取り組んでいます。
suffer [from]|～に苦しむ|Many people suffer from hunger.|多くの人が飢えに苦しんでいます。
hear [of]|～のことを聞く|I've never heard of the singer.|私はその歌手のことを聞いたことがありません。
feel [like] ～ing|～したい気がする|I feel like eating ice cream.|アイスクリームが食べたい気分です。
had [better] ～|～したほうがよい|You had better go to bed now.|もうねたほうがいいよ。
some ～, [others] …|～もいれば…もいる|Some people like summer, others like winter.|夏が好きな人もいれば冬が好きな人もいます。
one ～, the [other] …|一方は～、もう一方は…|I have two dogs. One is white, the other is black.|犬を2ひき飼っています。1ぴきは白、もう1ぴきは黒です。
not only A [but] also B|AだけでなくBも|She speaks not only English but also French.|彼女は英語だけでなくフランス語も話します。
look [up] to|～を尊敬する|I look up to my father.|私は父を尊敬しています。
be [about] to ～|まさに～しようとしている|The movie is about to start.|映画がまさに始まろうとしています。
`;
