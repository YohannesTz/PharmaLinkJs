require("dotenv").config();

const { Telegraf, session, } = require('telegraf');
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { message } = require('telegraf/filters');
const LocalSession = require('telegraf-session-local');

const bot = new Telegraf(process.env.token);

//bot.use(session());

//do not uncomment. the bot's watch will cause nodemon to restart indefinetly. don't use with nodemon
bot.use((new LocalSession({ database: 'database.json' })).middleware())

const adminGroup = process.env.admin_group;


const welcomeText = `
Hi welcome to PharmLink. a bot that allows you to ask questions with your
community. also join if you didn't already https://t.me/testchannelicreated
/start - to restart the bot
/ask - to ask a new question
/about - about the makers`;

bot.start(async (ctx) => {

    //store state in session for user
    ctx.session = {
        userid: ctx.from.id, //current userId
        name: ctx.from.first_name, //displayName
        chatId: ctx.chat.id, // current chat Id
        isUserAsking: false, // flag if user is asking
        isUserAddingComment: false, // flag if user is adding comment
        commentQuestionId: -1, // comment request question id
        commentIndex: 0, // index for Browse Answers 💬
        isAnon: false, //user choice about being anonymus
        isCommenterAnon: false // again... user choice
    }

    if (ctx.startPayload) {
        if (ctx.startPayload.includes("question")) {
            console.log("Starting question...");
            const questionId = parseInt(ctx.startPayload.split("__")[1]);

            const getQuestion = await prisma.question.findFirst({
                where: {
                    id: questionId
                }
            });

            const getAnswers = await prisma.answer.findMany({
                where: {
                    questionId
                },
                take: 10
            });

            console.log(getQuestion.objectType);

            if (getQuestion.objectType == "text") {
                let content;
                if (getQuestion.isAnon) {
                    content = `**${getQuestion.text} \n\nBy: Anonymous**`;
                } else {
                    content = `**${getQuestion.text} \n\nBy: [${getQuestion.displayName}](tg://user?id=${getQuestion.fromUserId})**`;
                }
                console.log(content)
                await ctx.reply(
                    content,
                    {
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "add an Answer 💬", callback_data: `addComment-${questionId}` }
                                ]
                            ]
                        }
                    }
                );
            } else if (getQuestion.objectType == "photo") {
                let content;
                if (getQuestion.isAnon) {
                    content = `**${getQuestion.caption}\n\nBy: Anonymous**`;
                } else {
                    content = `**${getQuestion.caption}\n\nBy: [${getQuestion.displayName}](tg://user?id=${getQuestion.fromUserId})**`;
                }
                const fileId = getQuestion.text;
                await ctx.replyWithPhoto(
                    fileId,
                    {
                        caption: content,
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "add a comment", callback_data: `addComment-${questionId}` }
                                ]
                            ]
                        }
                    }
                );
            } else {
                let content;
                if (getQuestion.isAnon) {
                    content = `**By: Anonymous**`;
                } else {
                    content = `**By: [${getQuestion.displayName}](tg://user?id=${getQuestion.fromUserId})**`;
                }
                const fileId = getQuestion.text;
                await ctx.replyWithVoice(
                    fileId,
                    {
                        caption: content,
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "add a comment", callback_data: `addComment-${questionId}` }
                                ]
                            ]
                        }
                    }
                );
            }

            console.log("size: " + getAnswers.length);

            if (getAnswers.length < 5) {
                for (let i = 0; i < getAnswers.length; i++) {
                    let commentContent;
                    let fileId;

                    if (getAnswers[i].objectType == "text") {
                        if (getAnswers[i].isAnon) {
                            commentContent = `${getAnswers[i].text}\n\nBy Anonymous`;
                        } else {
                            commentContent = `${getAnswers[i].text}\n\nBy [${getAnswers[i].displayName}](tg://user?id=${getAnswers[i].fromUserId})`;
                        }
                    } else if (getAnswers[i].objectType == "photo") {
                        if (getAnswers[i].isAnon) {
                            commentContent = `${getAnswers[i].caption}\n\nBy Anonymous`;
                        } else {
                            commentContent = `${getAnswers[i].caption}\n\nBy [${getAnswers[i].displayName}](tg://user?id=${getAnswers[i].fromUserId})`;
                        }
                        fileId = getAnswers[i].text;
                    } else {
                        if (getAnswers[i].isAnon) {
                            commentContent = `By Anonymous`;
                        } else {
                            commentContent = `By [${getAnswers[i].displayName}](tg://user?id=${getAnswers[i].fromUserId})`;
                        }

                        fileId = getAnswers[i].text;
                    }

                    if (getAnswers[i].objectType == "text") {
                        console.log(commentContent);
                        await ctx.reply(
                            commentContent,
                            {
                                parse_mode: "MarkdownV2",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: `(${getAnswers[i].likes}) 👍`, callback_data: `thumbsup-${getAnswers[i].id}` },
                                            { text: `(${getAnswers[i].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[i].id}` },
                                            { text: `(${getAnswers[i].doubt}) 🤔`, callback_data: `doubt-${getAnswers[i].id}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    } else if (getAnswers[i].objectType == "photo") {
                        await ctx.replyWithPhoto(
                            fileId,
                            {
                                caption: commentContent,
                                parse_mode: "MarkdownV2",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: `(${getAnswers[i].likes}) 👍`, callback_data: `thumbsup-${getAnswers[i].id}` },
                                            { text: `(${getAnswers[i].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[i].id}` },
                                            { text: `(${getAnswers[i].doubt}) 🤔`, callback_data: `doubt-${getAnswers[i].id}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    } else {
                        await ctx.replyWithVoice(
                            fileId,
                            {
                                caption: commentContent,
                                parse_mode: "MarkdownV2",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: `(${getAnswers[i].likes}) 👍`, callback_data: `thumbsup-${getAnswers[i].id}` },
                                            { text: `(${getAnswers[i].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[i].id}` },
                                            { text: `(${getAnswers[i].doubt}) 🤔`, callback_data: `doubt-${getAnswers[i].id}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    }
                }
            } else {
                for (let j = 0; j < getAnswers.length; j++) {
                    let commentContent;
                    let fileId;

                    if (getAnswers[j].objectType == "text") {
                        if (getAnswers[j].isAnon) {
                            commentContent = `${getAnswers[j].text}\n\nBy Anonymous`;
                        } else {
                            commentContent = `${getAnswers[j].text}\n\nBy [${getAnswers[j].displayName}](tg://user?id=${getAnswers[j].fromUserId})`;
                        }
                    } else if (getAnswers[j].objectType == "photo") {
                        if (getAnswers[j].isAnon) {
                            commentContent = `${getAnswers[j].caption}\n\nBy Anonymous`;
                        } else {
                            commentContent = `${getAnswers[j].caption}\n\nBy [${getAnswers[j].displayName}](tg://user?id=${getAnswers[j].fromUserId})`;
                        }
                    } else {
                        if (getAnswers[j].isAnon) {
                            commentContent = `By Anonymous`;
                        } else {
                            commentContent = `By [${getAnswers[j].displayName}](tg://user?id=${getAnswers[j].fromUserId})`;
                        }
                        fileId = getAnswers[j].text;
                    }

                    if (j == 9) {
                        console.log("j == 9 (159)");

                        if (getAnswers[j].objectType == "text") {
                            await ctx.reply(
                                commentContent,
                                {
                                    parse_mode: "MarkdownV2",
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                            ],
                                            [
                                                { text: "Load More", callback_data: `loadMoreComment-${getAnswers[j].questionId}-${ctx.session.commentIndex}` }
                                            ]
                                        ]
                                    }
                                }
                            );
                        } else if (getAnswers[j].objectType == "photo") {
                            await ctx.replyWithVoice(
                                fileId,
                                {
                                    caption: commentContent,
                                    parse_mode: "MarkdownV2",
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].deslikes})👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                            ],
                                            [
                                                { text: "Load More", callback_data: `loadMoreComment-${getAnswers[j].questionId}-${ctx.session.commentIndex}` }
                                            ]
                                        ]
                                    }
                                }
                            );
                        } else {
                            await ctx.replyWithVoice(
                                fileId,
                                {
                                    caption: commentContent,
                                    parse_mode: "MarkdownV2",
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].deslikes})👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                            ],
                                            [
                                                { text: "Load More", callback_data: `loadMoreComment-${getAnswers[j].questionId}-${ctx.session.commentIndex}` }
                                            ]
                                        ]
                                    }
                                }
                            );
                        }
                    } else {
                        if (getAnswers[j].objectType == "text") {
                            await ctx.reply(
                                commentContent,
                                {
                                    parse_mode: "MarkdownV2",
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                            ]
                                        ]
                                    }
                                }
                            );
                        } else if (getAnswers[j].objectType == "photo") {
                            await ctx.replyWithPhoto(
                                fileId,
                                {
                                    caption: commentContent,
                                    parse_mode: "MarkdownV2",
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                            ]
                                        ]
                                    }
                                }
                            );
                        } else {
                            await ctx.replyWithVoice(
                                fileId,
                                {
                                    caption: commentContent,
                                    parse_mode: "MarkdownV2",
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                                { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                            ]
                                        ]
                                    }
                                }
                            );
                        }
                    }
                }
            }

            return;
        } else if (ctx.startPayload.includes("addanswer")) {
            console.log("add answers...");
            const questionId = parseInt(ctx.startPayload.split("__")[1]);
            ctx.session.chatId = ctx.chat.id;
            ctx.session.commentQuestionId = questionId;


            return await ctx.reply("Do you want to stay anonymus?", {
                reply_markup: {
                    inline_keyboard: [
                        [{ "text": "Yes", callback_data: "anonymus-commenter" }, { "text": "No", callback_data: "public-commenter" }]
                    ]
                }
            });

            //ctx.session.isUserAddingComment = true;
            //return await ctx.reply("send your answer as a voice, photo or text.");
        }
    } else {
        console.log("there is no payload...");
    }

    const userExists = await prisma.user.findFirst({
        where: {
            userId: ctx.from.id
        }
    })

    if (userExists) {
        return ctx.reply(`Hi, Welcome back. Its nice to have you back.
        ${welcomeText}`);
    }

    console.log(ctx)

    await ctx.reply(`Setting up...`);

    try {
        const newUser = await prisma.user.create({
            data: {
                chatId: ctx.chat.id,
                firstName: ctx.from.first_name,
                rating: 0.0,
                userId: ctx.from.id,
            }
        })

        console.log(newUser);

        return await ctx.reply(`
        Welcome to PharmaLink!${welcomeText}`, {
            reply_markup: {
                keyboard: [
                    ['Ask'], ['Help']
                ]
            }
        });
    } catch (error) {
        console.log(error);
        return await ctx.reply("Something was wrong...");
    }
});


// Handle button clicks
bot.hears('ask', async (ctx) => {
    return await ctx.reply('You clicked Button 1')
})

bot.hears('help', async (ctx) => {
    return await ctx.reply('You clicked Button 2')
})

bot.on('inline_query', async (ctx) => {
    console.log(ctx);
    return await ctx.reply('sdfsdf');
});

bot.command("ask", async (ctx) => {
    ctx.session.chatId = ctx.chat.id;
    //ctx.session.isUserAsking = true;
    //return await ctx.reply("Send me your question as voice or text, I will forward it to admins on behalf of you");
    return await ctx.reply("Do you want to stay anonymus?", {
        reply_markup: {
            inline_keyboard: [
                [{ "text": "Yes", callback_data: "anonymus-poster" }, { "text": "No", callback_data: "public-poster" }]
            ]
        }
    });
});

bot.on(message('voice'), async (ctx) => {

    if (ctx.session.isUserAsking) {
        const fileId = ctx.message.voice.file_id;
        ctx.session.isUserAsking = false;

        try {
            const newQuestion = await prisma.question.create({
                data: {
                    text: fileId,
                    isApproved: false,
                    fromUserId: ctx.message.from.id,
                    answersCount: 0,
                    questionChatId: ctx.session.chatId,
                    questionMessageId: ctx.message.message_id,
                    displayName: ctx.message.from.first_name,
                    isAnon: ctx.session.isAnon,
                    caption: '',
                    objectType: "voice"
                }
            });

            console.log(newQuestion);
            let text;

            if (ctx.session.isAnon) {
                text = `**Question ${newQuestion.id} By Anonymous**`
            } else {
                text = `**Question ${newQuestion.id} By [${newQuestion.displayName}](tg://user?id=${newQuestion.fromUserId})**`
            }

            await ctx.forwardMessage(adminGroup, newQuestion.questionMessageId);

            await ctx.telegram.sendMessage(
                adminGroup,
                text,
                {
                    parse_mode: "MarkdownV2",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "Approve", callback_data: `approvequestion-${newQuestion.id}` }, { text: "Decline", callback_data: `declinequestion-${newQuestion.id}` }],
                        ]
                    }
                }
            );

            return await ctx.sendMessage("Your question has been sent for review! You will be notified when it is approved or rejected.");
        } catch (error) {
            console.log(error);
            return await ctx.reply("Something was wrong!");
        }
    } else if (ctx.session.isUserAddingComment) {
        ctx.session.isUserAddingComment = false;
        const fileId = ctx.message.voice.file_id;

        try {
            await prisma.answer.create({
                data: {
                    text: fileId,
                    fromUserId: ctx.message.from.id,
                    userId: ctx.message.from.id,
                    questionId: parseInt(ctx.session.commentQuestionId),
                    displayName: ctx.message.from.first_name,
                    objectType: "voice",
                    likes: 0,
                    deslikes: 0,
                    isAnon: ctx.session.isCommenterAnon,
                    caption: "",
                    doubt: 0
                }
            });

            const updateAnswerCount = await prisma.question.update({
                where: {
                    id: parseInt(ctx.session.commentQuestionId)
                },
                data: {
                    answersCount: {
                        increment: 1
                    }
                }
            });

            console.log(updateAnswerCount);

            //Update comment count
            const link = `https://t.me/${process.env.username}?start=question__${updateAnswerCount.id}`
            const addanswerLink = `https://t.me/${process.env.username}?start=addanswer__${updateAnswerCount.id}`
            await ctx.telegram.editMessageReplyMarkup(
                updateAnswerCount.questionChatId.toString(),
                updateAnswerCount.questionMessageId.toString(),
                undefined,
                {
                    inline_keyboard: [
                        [{ text: `Browse Answers 💬 (${updateAnswerCount.answersCount})`, url: link, resize_keyboard: true }, { text: `Answer ➕`, url: addanswerLink, resize_keyboard: true },],
                    ]
                }
            );

            return ctx.reply("Success!");
        } catch (error) {
            console.log(error);
            return ctx.reply("Oops! something was wrong!");
        }
    }
});

bot.on(message('photo'), async (ctx) => {
    if (ctx.session.isUserAsking) {
        const fileId = ctx.message.photo[0].file_id;
        const cap = ctx.message.caption || "";
        ctx.session.isUserAsking = false;
        try {
            const newQuestion = await prisma.question.create({
                data: {
                    text: fileId,
                    isApproved: false,
                    fromUserId: ctx.message.from.id,
                    answersCount: 0,
                    questionChatId: ctx.session.chatId,
                    questionMessageId: ctx.message.message_id,
                    displayName: ctx.message.from.first_name,
                    isAnon: ctx.session.isAnon,
                    caption: cap,
                    objectType: "photo"
                }
            });

            console.log(newQuestion);
            let text;

            if (ctx.session.isAnon) {
                text = `**Question ${newQuestion.id} By Anonymous**`
            } else {
                text = `**Question ${newQuestion.id} By [${newQuestion.displayName}](tg://user?id=${newQuestion.fromUserId})**`
            }

            await ctx.forwardMessage(adminGroup, newQuestion.questionMessageId);

            await ctx.telegram.sendMessage(
                adminGroup,
                text,
                {
                    parse_mode: "MarkdownV2",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "Approve", callback_data: `approvequestion-${newQuestion.id}` }, { text: "Decline", callback_data: `declinequestion-${newQuestion.id}` }],
                        ]
                    }
                }
            );

            return await ctx.sendMessage("Your question has been sent for review! You will be notified when it is approved or rejected.");
        } catch (error) {
            console.log(error);
            return await ctx.reply("Something was wrong!");
        }
    } else if (ctx.session.isUserAddingComment) {
        ctx.session.isUserAddingComment = false;
        const fileId = ctx.message.photo[0].file_id;
        const cap = ctx.message.caption || "";

        try {
            await prisma.answer.create({
                data: {
                    text: fileId,
                    fromUserId: ctx.message.from.id,
                    userId: ctx.message.from.id,
                    questionId: parseInt(ctx.session.commentQuestionId),
                    displayName: ctx.message.from.first_name,
                    objectType: "photo",
                    likes: 0,
                    deslikes: 0,
                    isAnon: ctx.session.isCommenterAnon,
                    caption: cap,
                    doubt: 0
                }
            });

            const updateAnswerCount = await prisma.question.update({
                where: {
                    id: parseInt(ctx.session.commentQuestionId)
                },
                data: {
                    answersCount: {
                        increment: 1
                    }
                }
            });

            console.log(updateAnswerCount);

            //Update comment count
            const link = `https://t.me/${process.env.username}?start=question__${updateAnswerCount.id}`
            const addanswerLink = `https://t.me/${process.env.username}?start=addanswer__${updateAnswerCount.id}`
            await ctx.telegram.editMessageReplyMarkup(
                updateAnswerCount.questionChatId.toString(),
                updateAnswerCount.questionMessageId.toString(),
                undefined,
                {
                    inline_keyboard: [
                        [{ text: `Browse Answers 💬 (${updateAnswerCount.answersCount})`, url: link, resize_keyboard: true }, { text: `Answer ➕`, url: addanswerLink, resize_keyboard: true },],
                    ]
                }
            );

            return ctx.reply("Success!");
        } catch (error) {
            console.log(error);
            return ctx.reply("Oops! something was wrong!");
        }
    }
})

bot.on(message('text'), async (ctx) => {
    console.log(ctx);
    if (ctx.session.isUserAsking) {
        ctx.session.isUserAsking = false;

        const question_text = makeParsable(ctx.message.text);
        try {
            const newQuestion = await prisma.question.create({
                data: {
                    text: question_text,
                    isApproved: false,
                    fromUserId: ctx.message.from.id,
                    answersCount: 0,
                    questionChatId: ctx.session.chatId,
                    questionMessageId: ctx.message.message_id,
                    displayName: ctx.message.from.first_name,
                    isAnon: ctx.session.isAnon,
                    caption: '',
                    objectType: "text"
                }
            });

            console.log(newQuestion);
            let text;

            if (ctx.session.isAnon) {
                text = `**Question ${newQuestion.id} By Anonymous**`
            } else {
                text = `**Question ${newQuestion.id} By [${newQuestion.displayName}](tg://user?id=${newQuestion.fromUserId})**`
            }

            await ctx.forwardMessage(adminGroup, newQuestion.questionMessageId);
            await ctx.telegram.sendMessage(
                adminGroup,
                text,
                {
                    parse_mode: "MarkdownV2",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "Approve", callback_data: `approvequestion-${newQuestion.id}` }, { text: "Decline", callback_data: `declinequestion-${newQuestion.id}` }],
                        ]
                    }
                }
            )

            return await ctx.sendMessage("Your question has been sent for review! You will be notified when it is approved or rejected.");
        } catch (error) {
            console.log(error);
            return await ctx.reply("Something was wrong!");
        }
    } else if (ctx.session.isUserAddingComment) {
        ctx.session.isUserAddingComment = false;

        try {
            const comment_text = makeParsable(ctx.message.text);

            await prisma.answer.create({
                data: {
                    text: comment_text,
                    fromUserId: ctx.message.from.id,
                    userId: ctx.message.from.id,
                    questionId: parseInt(ctx.session.commentQuestionId),
                    displayName: ctx.message.from.first_name,
                    objectType: "text",
                    likes: 0,
                    deslikes: 0,
                    doubt: 0,
                    isAnon: ctx.session.isCommenterAnon,
                    caption: ""
                }
            });

            const updateAnswerCount = await prisma.question.update({
                where: {
                    id: parseInt(ctx.session.commentQuestionId)
                },
                data: {
                    answersCount: {
                        increment: 1
                    }
                }
            });

            console.log(updateAnswerCount);

            //Update comment count
            const link = `https://t.me/${process.env.username}?start=question__${updateAnswerCount.id}`
            const addanswerLink = `https://t.me/${process.env.username}?start=addanswer__${updateAnswerCount.id}`
            await ctx.telegram.editMessageReplyMarkup(
                updateAnswerCount.questionChatId.toString(),
                updateAnswerCount.questionMessageId.toString(),
                undefined,
                {
                    inline_keyboard: [
                        [{ text: `Browse Answers 💬 (${updateAnswerCount.answersCount})`, url: link, resize_keyboard: true }, { text: `Answer ➕`, url: addanswerLink, resize_keyboard: true },],
                    ]
                }
            );

            return ctx.reply("Success!");
        } catch (error) {
            console.log(error);
            return ctx.reply("Oops! something was wrong!");
        }
    }
})

bot.action("anonymus-poster", async (ctx) => {
    ctx.session.isAnon = true;
    await ctx.editMessageReplyMarkup({
        reply_markup: { remove_keyboard: true },
    });

    await ctx.answerCbQuery("We respect your choice!");
    ctx.session.isUserAsking = true;
    return await ctx.reply("Send me your question as voice, photo or text, I will forward it to admins on behalf of you");
});

bot.action("public-poster", async (ctx) => {
    ctx.session.isAnon = false;
    await ctx.editMessageReplyMarkup({
        reply_markup: { remove_keyboard: true },
    });
    await ctx.answerCbQuery("We respect your choice!");
    ctx.session.isUserAsking = true;
    return await ctx.reply("Send me your question as voice, photo or text, I will forward it to admins on behalf of you");
});

bot.action(/addComment-[0-9]+/, async (ctx) => {
    const str = ctx.update.callback_query.data;
    const questionId = str.replace(/\D/g, '');

    ctx.session.chatId = ctx.chat.id;
    ctx.session.commentQuestionId = questionId;
    return await ctx.reply("Do you want to stay anonymus?", {
        reply_markup: {
            inline_keyboard: [
                [{ "text": "Yes", callback_data: "anonymus-commenter" }, { "text": "No", callback_data: "public-commenter" }]
            ]
        }
    });
});

bot.action("anonymus-commenter", async (ctx) => {
    ctx.session.isCommenterAnon = true;
    await ctx.editMessageReplyMarkup({
        reply_markup: { remove_keyboard: true },
    });
    await ctx.answerCbQuery("We respect your choice!");
    ctx.session.isUserAddingComment = true;
    return await ctx.reply("Send me your Answer as voice, photo or text");
})

bot.action("public-commenter", async (ctx) => {
    ctx.session.isCommenterAnon = false;
    await ctx.editMessageReplyMarkup({
        reply_markup: { remove_keyboard: true },
    });
    await ctx.answerCbQuery("We respect your choice!");
    ctx.session.isUserAddingComment = true;
    return await ctx.reply("Send me your Answer as voice, photo or text");
});

bot.action(/loadMoreComment-[0-9]+-[0-9]+/, async (ctx) => {
    const string = ctx.update.callback_query.data;
    const loadMoreCommentArgs = string.split("-")

    //get questionId and index to return the new page.
    const qId = loadMoreCommentArgs[1];
    const index = loadMoreCommentArgs[2];

    ctx.session.commentIndex = parseInt(ctx.session.commentIndex) + 10;

    try {
        const getAnswers = await prisma.answer.findMany({
            where: {
                questionId: parseInt(qId)
            },
            skip: parseInt(ctx.session.commentIndex),
            take: 10
        });

        console.log(getAnswers);

        if (getAnswers.length < 5) {
            for (let i = 0; i < getAnswers.length; i++) {
                let commentContent;
                if (getAnswers[i].isAnon) {
                    commentContent = `${getAnswers[i].text}\n\nBy Anonymous`;
                } else {
                    commentContent = `${getAnswers[i].text}\n\nBy [${getAnswers[i].displayName}](tg://user?id=${getAnswers[i].fromUserId})`;
                }

                await ctx.reply(
                    commentContent,
                    {
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: `(${getAnswers[i].likes}) 👍`, callback_data: `thumbsup-${getAnswers[i].id}` },
                                    { text: `(${getAnswers[i].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[i].id}` },
                                    { text: `(${getAnswers[i].likes}) 🤔`, callback_data: `doubt-${getAnswers[i].id}` }
                                ]
                            ]
                        }
                    }
                );
            }
        } else {
            for (let j = 0; j < getAnswers.length; j++) {
                let commentContent;
                let fileId;

                if (getAnswers[j].objectType == "text") {
                    if (getAnswers[j].isAnon) {
                        commentContent = `${getAnswers[j].text}\n\nBy Anonymus`;
                    } else {
                        commentContent = `${getAnswers[j].text}\n\nBy [${getAnswers[j].displayName}](tg://user?id=${getAnswers[j].fromUserId})`;
                    }
                } else if (getAnswers[j].objectType == "photo") {
                    if (getAnswers[j].isAnon) {
                        commentContent = `${getAnswers[j].caption}\n\nBy Anonymus`;
                    } else {
                        commentContent = `${getAnswers[j].caption}\n\nBy [${getAnswers[j].displayName}](tg://user?id=${getAnswers[j].fromUserId})`;
                    }
                } else {
                    if (getAnswers[j].isAnon) {
                        commentContent = `By Anonymus`;
                    } else {
                        commentContent = `By [${getAnswers[j].displayName}](tg://user?id=${getAnswers[j].fromUserId})`;
                    }
                    fileId = getAnswers[j].text;
                }

                if (j == 9) {
                    console.log("j == 9 (159)");

                    if (getAnswers[j].objectType == "text") {
                        await ctx.reply(
                            commentContent,
                            {
                                parse_mode: "MarkdownV2",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                        ],
                                        [
                                            { text: "Load More", callback_data: `loadMoreComment-${getAnswers[j].questionId}-${ctx.session.commentIndex}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    } else if (getAnswers[j].objectType == "photo") {
                        await ctx.replyWithPhoto(
                            fileId,
                            {
                                caption: commentContent,
                                parse_mode: "MarkdownV2",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                        ],
                                        [
                                            { text: "Load More", callback_data: `loadMoreComment-${getAnswers[j].questionId}-${ctx.session.commentIndex}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    } else {
                        await ctx.replyWithVoice(
                            fileId,
                            {
                                caption: commentContent,
                                parse_mode: "MarkdownV2",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                        ],
                                        [
                                            { text: "Load More", callback_data: `loadMoreComment-${getAnswers[j].questionId}-${ctx.session.commentIndex}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    }
                } else {
                    if (getAnswers[j].objectType == "text") {
                        await ctx.reply(
                            commentContent,
                            {
                                parse_mode: "MarkdownV2",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    } else if (getAnswers[j].objectType == "photo") {
                        await ctx.replyWithPhoto(
                            fileId,
                            {
                                caption: commentContent,
                                parse_mode: "MarkdownV2",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                        ],
                                        [
                                            { text: "Load More", callback_data: `loadMoreComment-${getAnswers[j].questionId}-${ctx.session.commentIndex}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    } else {
                        await ctx.replyWithVoice(
                            fileId,
                            {
                                caption: commentContent,
                                parse_mode: "MarkdownV2",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: `(${getAnswers[j].likes}) 👍`, callback_data: `thumbsup-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].deslikes}) 👎`, callback_data: `thumbsdown-${getAnswers[j].id}` },
                                            { text: `(${getAnswers[j].doubt}) 🤔`, callback_data: `doubt-${getAnswers[j].id}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    }
                }
            }
        }

        return;
    } catch (error) {
        console.log(error);
        return await ctx.reply("Oops! something was wrong while fetching answers...");
    }
})

bot.action(/thumbsup-[0-9]+/, async (ctx) => {
    const string = ctx.update.callback_query.data;
    const commentId = string.replace(/\D/g, '');
    const actionUserId = ctx.from.id;

    //check if action exists before doing anything
    const checkAction = await prisma.action.count({
        where: {
            answerId: parseInt(commentId),
            userId: parseInt(actionUserId)
        }
    });

    console.log(checkAction);

    if (checkAction <= 0) {
        const updateComment = await prisma.answer.update({
            where: {
                id: parseInt(commentId)
            },
            data: {
                likes: {
                    increment: 1
                }
            }
        });

        //console.log(updateComment);

        const insertAction = await prisma.action.create({
            data: {
                answerId: parseInt(commentId),
                userId: parseInt(actionUserId),
                actionType: "like"
            }
        });

        console.log(insertAction);

        let commentContent;

        if (updateComment.objectType == "text") {
            if (updateComment.isAnon) {
                commentContent = `${updateComment.text}\n\nBy Anonymous`;
            } else {
                commentContent = `\nBy [${getAnswers[j].displayName}](tg://user?id=${getAnswers[j].fromUserId})\n`;
            }
            await ctx.editMessageText(
                commentContent,
                {
                    parse_mode: "MarkdownV2",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: `(${updateComment.likes}) 👍`, callback_data: `thumbsup-${updateComment.id}` },
                                { text: `(${updateComment.deslikes}) 👎`, callback_data: `thumbsdown-${updateComment.id}` },
                                { text: `(${updateComment.doubt}) 🤔`, callback_data: `doubt-${updateComment.id}` }
                            ]
                        ]
                    }
                }
            );
        } else if (updateComment.objectType == "photo") {
            if (updateComment.isAnon) {
                commentContent = `${updateComment.caption}\n\nBy Anonymous`;
            } else {
                commentContent = `${updateComment.caption}\n\nBy [${updateComment.displayName}](tg://user?id=${updateComment.fromUserId})`;
            }
            await ctx.editMessageCaption(
                commentContent,
                {
                    parse_mode: "MarkdownV2",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: `(${updateComment.likes}) 👍`, callback_data: `thumbsup-${updateComment.id}` },
                                { text: `(${updateComment.deslikes}) 👎`, callback_data: `thumbsdown-${updateComment.id}` },
                                { text: `(${updateComment.doubt}) 🤔`, callback_data: `doubt-${updateComment.id}` }
                            ]
                        ]
                    }
                }
            );
        } else {
            if (updateComment.isAnon) {
                commentContent = `\nBy Anonymous`;
            } else {
                commentContent = `\nBy [${updateComment.displayName}](tg://user?id=${updateComment.fromUserId})`;
            }
            await ctx.editMessageCaption(
                commentContent,
                {
                    parse_mode: "MarkdownV2",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: `(${updateComment.likes}) 👍`, callback_data: `thumbsup-${updateComment.id}` },
                                { text: `(${updateComment.deslikes}) 👎`, callback_data: `thumbsdown-${updateComment.id}` },
                                { text: `(${updateComment.doubt}) 🤔`, callback_data: `doubt-${updateComment.id}` }
                            ]
                        ]
                    }
                }
            );
        }
    } else {
        return await ctx.answerCbQuery("Thanks for the feedback but you have done this before!");
    }

    return await ctx.answerCbQuery("Successfully liked!");
});


bot.action(/thumbsdown-[0-9]+/, async (ctx) => {
    const string = ctx.update.callback_query.data;
    const commentId = string.replace(/\D/g, '');
    const actionUserId = ctx.from.id;

    const checkAction = await prisma.action.count({
        where: {
            answerId: parseInt(commentId),
            userId: parseInt(actionUserId)
        }
    });

    if (checkAction <= 0) {
        const comment = await prisma.answer.findFirst({
            where: {
                id: parseInt(commentId),
            }
        });

        if (comment.likes >= 1) {
            const updateComment = await prisma.answer.update({
                where: {
                    id: parseInt(commentId)
                },
                data: {
                    deslikes: {
                        increment: 1
                    }
                }
            });

            const insertAction = await prisma.action.create({
                data: {
                    answerId: parseInt(commentId),
                    userId: parseInt(actionUserId),
                    actionType: "like"
                }
            });

            console.log(insertAction);

            let commentContent;

            if (updateComment.objectType == "text") {
                if (updateComment.isAnon) {
                    commentContent = `${updateComment.text}\n\nBy Anonymous`;
                } else {
                    commentContent = `${updateComment.text}\n\nBy [${updateComment.displayName}](tg://user?id=${updateComment.fromUserId})`;
                }
                await ctx.editMessageText(
                    commentContent,
                    {
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: `(${updateComment.likes}) 👍`, callback_data: `thumbsup-${updateComment.id}` },
                                    { text: `(${updateComment.deslikes}) 👎`, callback_data: `thumbsdown-${updateComment.id}` },
                                    { text: `(${updateComment.doubt}) 🤔`, callback_data: `doubt-${updateComment.id}` }
                                ]
                            ]
                        }
                    }
                );
            } else if (updateComment.objectType == "photo") {
                if (updateComment.isAnon) {
                    commentContent = `${updateComment.caption}\n\nBy Anonymous`;
                } else {
                    commentContent = `${updateComment.caption}\n\nBy [${updateComment.displayName}](tg://user?id=${updateComment.fromUserId})`;
                }
                await ctx.editMessageCaption(
                    commentContent,
                    {
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: `(${updateComment.likes}) 👍`, callback_data: `thumbsup-${updateComment.id}` },
                                    { text: `(${updateComment.deslikes}) 👎`, callback_data: `thumbsdown-${updateComment.id}` },
                                    { text: `(${updateComment.doubt}) 🤔`, callback_data: `doubt-${updateComment.id}` }
                                ]
                            ]
                        }
                    }
                );
            } else {
                if (updateComment.isAnon) {
                    commentContent = `\nBy Anonymous`;
                } else {
                    commentContent = `\nBy [${updateComment.displayName}](tg://user?id=${updateComment.fromUserId})`;
                }
                await ctx.editMessageCaption(
                    commentContent,
                    {
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: `(${updateComment.likes}) 👍`, callback_data: `thumbsup-${updateComment.id}` },
                                    { text: `(${updateComment.deslikes}) 👎`, callback_data: `thumbsdown-${updateComment.id}` },
                                    { text: `(${updateComment.doubt}) 🤔`, callback_data: `doubt-${updateComment.id}` }
                                ]
                            ]
                        }
                    }
                );
            }
        }
    } else {
        return await ctx.answerCbQuery("Thanks for the feedback but you have done this before!");
    }

    return await ctx.answerCbQuery("Successfully disliked!");
});

bot.action(/doubt-[0-9]+/, async (ctx) => {
    const string = ctx.update.callback_query.data;
    const commentId = string.replace(/\D/g, '');
    const actionUserId = ctx.from.id;

    const checkAction = await prisma.action.count({
        where: {
            answerId: parseInt(commentId),
            userId: parseInt(actionUserId)
        }
    });

    if (checkAction <= 0) {
        const updateComment = await prisma.answer.update({
            where: {
                id: parseInt(commentId)
            },
            data: {
                doubt: {
                    increment: 1
                }
            }
        });

        const insertAction = await prisma.action.create({
            data: {
                answerId: parseInt(commentId),
                userId: parseInt(actionUserId),
                actionType: "doubt"
            }
        });

        console.log(insertAction);

        await ctx.editMessageReplyMarkup(
            {
                inline_keyboard: [
                    [
                        { text: `(${updateComment.likes}) 👍`, callback_data: `thumbsup-${updateComment.id}` },
                        { text: `(${updateComment.deslikes}) 👎`, callback_data: `thumbsdown-${updateComment.id}` },
                        { text: `(${updateComment.doubt}) 🤔`, callback_data: `doubt-${updateComment.id}` }
                    ]
                ]
            }
        );
    } else {
        return await ctx.answerCbQuery("Thanks for the feedback but you have done this before!");
    }

    return await ctx.answerCbQuery("Success!");
});

bot.action(/approvequestion-[0-9]+/, async (ctx) => {
    const str = ctx.update.callback_query.data;
    const id = str.replace(/\D/g, '');

    const approvedquestion = await prisma.question.update({
        where: {
            id: parseInt(id)
        },
        data: {
            isApproved: true
        }
    });

    console.log(approvedquestion);

    //show toast
    await ctx.answerCbQuery("Success!");

    //Send message to original user using the chatId
    const link = `https://t.me/${process.env.username}?start=question__${approvedquestion.id}`
    const addanswerLink = `https://t.me/${process.env.username}?start=addanswer__${approvedquestion.id}`

    //Update markup inline
    await ctx.editMessageReplyMarkup({
        inline_keyboard: [
            [
                { text: `Browse Answers 💬 (${approvedquestion.answersCount})`, url: link, resize_keyboard: true },
                { text: `Answer ➕`, url: addanswerLink, resize_keyboard: true },
            ],
        ]
    });


    //send to channel after checking if the object is voice, photo or text
    if (approvedquestion.objectType == "text") {
        let content;

        if (approvedquestion.isAnon) {
            content = `**${approvedquestion.text} \n\nBy: Anonymous**`;
        } else {
            content = `**${approvedquestion.text} \n\nBy: [${approvedquestion.displayName}](tg://user?id=${approvedquestion.fromUserId})**`;
        }
        let channelPost = await ctx.telegram.sendMessage(
            process.env.dest_chan,
            content,
            {
                parse_mode: "MarkdownV2",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: `Browse Answers 💬 (${approvedquestion.answersCount})`, url: link, resize_keyboard: true },
                            { text: `Answer ➕`, url: addanswerLink, resize_keyboard: true },
                        ],
                    ]
                }
            }
        );

        await prisma.question.update({
            data: {
                questionMessageId: channelPost.message_id,
                questionChatId: channelPost.chat.id
            },
            where: {
                id: approvedquestion.id
            }
        })
    } else if (approvedquestion.objectType == "photo") {
        let content;

        if (approvedquestion.isAnon) {
            content = `${approvedquestion.caption}\n\n**By: Anonymous**`;
        } else {
            content = `${approvedquestion.caption}\n\n**By: [${approvedquestion.displayName}](tg://user?id=${approvedquestion.fromUserId})**`;
        }

        console.log(content);

        let channelPost = await ctx.telegram.sendPhoto(
            process.env.dest_chan,
            approvedquestion.text,
            {
                parse_mode: "MarkdownV2",
                caption: content,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: `Browse Answers 💬 (${approvedquestion.answersCount})`, url: link, resize_keyboard: true },
                            { text: `Answer ➕`, url: addanswerLink, resize_keyboard: true },
                        ],
                    ]
                }
            }
        );

        await prisma.question.update({
            data: {
                questionMessageId: channelPost.message_id,
                questionChatId: channelPost.chat.id
            },
            where: {
                id: approvedquestion.id
            }
        })

    } else {
        let content;

        if (approvedquestion.isAnon) {
            content = `**By: Anonymous**`;
        } else {
            content = `**By: [${approvedquestion.displayName}](tg://user?id=${approvedquestion.fromUserId})**`;
        }

        console.log(content);

        let channelPost = await ctx.telegram.sendVoice(
            process.env.dest_chan,
            approvedquestion.text,
            {
                parse_mode: "MarkdownV2",
                caption: content,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: `Browse Answers 💬 (${approvedquestion.answersCount})`, url: link, resize_keyboard: true },
                            { text: `Answer ➕`, url: addanswerLink, resize_keyboard: true },
                        ],
                    ]
                }
            }
        );

        await prisma.question.update({
            data: {
                questionMessageId: channelPost.message_id,
                questionChatId: channelPost.chat.id
            },
            where: {
                id: approvedquestion.id
            }
        })
    }

    await ctx.telegram.sendMessage(approvedquestion.questionChatId.toString(), "Your Question has been approved and posted! Thank you for your contribution!");

    //reply to group
    return ctx.reply("Question was approved 👍!");
});

bot.action(/declinequestion-[0-9]+/, async (ctx) => {
    const str = ctx.update.callback_query.data;
    const id = str.replace(/\D/g, '');

    const declinedquestion = await prisma.question.update({
        where: {
            id: parseInt(id)
        },
        data: {
            isApproved: false
        }
    });

    console.log("declined...");
    console.log(declinedquestion);

    //show toast
    await ctx.answerCbQuery("Success!");

    //Send message to original user using the chatId
    await ctx.telegram.sendMessage(declinedquestion.questionChatId.toString(), "Your question has been Declined! please try again later...");

    //Update markup inline
    await ctx.editMessageReplyMarkup({
        reply_markup: { remove_keyboard: true },
    });

    //reply to group
    return ctx.reply("Question was declined 👍!");
});

/* bot.launch({
    webhook: {
        domain: "path/to/the/server/url",
        port: process.env.PORT
    }
}); */

bot.launch();

function makeParsable(text) {
    return text
        .replace(/\_/g, '\\_')
        .replace(/\*/g, '\\*')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\~/g, '\\~')
        .replace(/\`/g, '\\`')
        .replace(/\>/g, '\\>')
        .replace(/\#/g, '\\#')
        .replace(/\+/g, '\\+')
        .replace(/\-/g, '\\-')
        .replace(/\=/g, '\\=')
        .replace(/\|/g, '\\|')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\./g, '\\.')
        .replace(/\!/g, '\\!')
}

console.log("Bot started successfully!");
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
