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
Hi welcome to PharmaLink. a bot that allows you to ask questions with your
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
    }

    if (ctx.startPayload) {
        console.log(ctx.startPayload);
        console.log(ctx.startPayload.includes("addanswer"))
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

            if (getQuestion.objectType == "text") {
                const content = `**${getQuestion.text} \n\nAt:${makeParsable(new Date(getQuestion.createdAt).toISOString().split('T')[0])}\nBy: [${getQuestion.displayName}](tg://user?id=${getQuestion.fromUserId})**`;
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
            } else {
                const content = `**By: [${getQuestion.displayName}](tg://user?id=${getQuestion.fromUserId})**`;
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
                    const commentContent = `${getAnswers[i].text}\n\nAt:${makeParsable(new Date(getAnswers[i].createdAt).toISOString().split('T')[0])}\nBy [${getAnswers[i].displayName}](tg://user?id=${getAnswers[i].fromUserId})`;

                    await ctx.reply(
                        commentContent,
                        {
                            parse_mode: "MarkdownV2",
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: "0 👍", callback_data: `thumbsup-${getAnswers[i].id}` },
                                        { text: "0 👎", callback_data: `thumbsdown-${getAnswers[i].id}` },
                                        { text: "0 🤔", callback_data: `doubt-${getAnswers[i].id}` }
                                    ]
                                ]
                            }
                        }
                    );
                }
            } else {
                for (let j = 0; j < getAnswers.length; j++) {
                    const commentContent = `${getAnswers[j].text}\n\nAt:${makeParsable(new Date(getAnswers[j].createdAt).toISOString().split('T')[0])}\nBy [${getAnswers[j].displayName}](tg://user?id=${getAnswers[j].fromUserId})`;
                    if (j == 9) {
                        console.log("index == 8");

                        await ctx.reply(
                            commentContent,
                            {
                                parse_mode: "MarkdownV2",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: "0 👍", callback_data: `thumbsup-${getAnswers[j].id}` },
                                            { text: "0 👎", callback_data: `thumbsdown-${getAnswers[j].id}` },
                                            { text: "0 🤔", callback_data: `doubt-${getAnswers[j].id}` }
                                        ],
                                        [
                                            { text: "Load More", callback_data: `loadMoreComment-${questionId}-${10}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    } else {
                        await ctx.reply(
                            commentContent,
                            {
                                parse_mode: "MarkdownV2",
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: "0 👍", callback_data: `thumbsup-${getAnswers[j].id}` },
                                            { text: "0 👎", callback_data: `thumbsdown-${getAnswers[j].id}` },
                                            { text: "0 🤔", callback_data: `doubt-${getAnswers[j].id}` }
                                        ]
                                    ]
                                }
                            }
                        );
                    }
                }
            }

            return;
        } else if (ctx.startPayload.includes("addanswer")) {
            console.log("add answers...");
            const questionId = parseInt(ctx.startPayload.split("__")[1]);

            ctx.session.chatId = ctx.chat.id;
            ctx.session.commentQuestionId = questionId;
            ctx.session.isUserAddingComment = true;

            return await ctx.reply("send your answer as a voice or text.");
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

        await ctx.reply(`
        Welcome to PharmaLink!${welcomeText}`);
    } catch (error) {
        console.log(error);
        await ctx.reply("Something was wrong...");
    }
});

bot.command("ask", async (ctx) => {
    ctx.session.chatId = ctx.chat.id;
    ctx.session.isUserAsking = true;
    return await ctx.reply("Send me your question as voice or text, I will forward it to admins on behalf of you");
});

bot.on(message('voice'), async (ctx) => {
    /* const voice = ctx.message.voice;
    const fileId = voice.file_id;
    const fileUrl = `https://api.telegram.org/file/bot/${process.env.token}/${voice.file_path}`
    return await ctx.replyWithVoice(fileId, {
        caption: "Your voice is heard!"
    }); */
    if (ctx.session.isUserAsking) {
        ctx.session.isUserAsking = false;

        const fileId = ctx.message.voice.file_id;

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
                    objectType: "voice"
                }
            });

            console.log(newQuestion);
            const text = `**Question ${newQuestion.id} By [${newQuestion.displayName}](tg://user?id=${newQuestion.fromUserId}) at ${makeParsable(new Date(newQuestion.createdAt).toISOString().split('T')[0])}**`
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
                        [{ text: `Browse Answers 💬 (${updateAnswerCount.answersCount})`, url: link }, { text: `Answer ➕`, url: addanswerLink, resize_keyboard: true },],
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
                    objectType: "text"
                }
            });

            console.log(newQuestion);

            const text = `**Question ${newQuestion.id} By [${newQuestion.displayName}](tg://user?id=${newQuestion.fromUserId}) at ${makeParsable(new Date(newQuestion.createdAt).toISOString().split('T')[0])}**`
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
                        [{ text: `Browse Answers 💬 (${updateAnswerCount.answersCount})`, url: link }, { text: `Answer ➕`, url: addanswerLink, resize_keyboard: true },],
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

bot.action(/addComment-[0-9]+/, async (ctx) => {
    const str = ctx.update.callback_query.data;
    const questionId = str.replace(/\D/g, '');

    ctx.session.chatId = ctx.chat.id;
    ctx.session.commentQuestionId = questionId;
    ctx.session.isUserAddingComment = true;

    return await ctx.reply("send your answer as a voice or text.");
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
                const commentContent = `${getAnswers[i].text}\n\nAt:${makeParsable(new Date(getAnswers[i].createdAt).toISOString().split('T')[0])}\nBy [${getAnswers[i].displayName}](tg://user?id=${getAnswers[i].fromUserId})`;

                await ctx.reply(
                    commentContent,
                    {
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "0 👍", callback_data: `thumbsup-${getAnswers[i].id}` },
                                    { text: "0 👎", callback_data: `thumbsdown-${getAnswers[i].id}` },
                                    { text: "0 🤔", callback_data: `doubt-${getAnswers[i].id}` }
                                ]
                            ]
                        }
                    }
                );
            }
        } else {
            for (let j = 0; j < getAnswers.length; j++) {
                const commentContent = `${getAnswers[j].text}\n\nBy [${getAnswers[j].displayName}](tg://user?id=${getAnswers[j].fromUserId})`;
                if (j == 9) {
                    console.log("index == 8");

                    await ctx.reply(
                        commentContent,
                        {
                            parse_mode: "MarkdownV2",
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: "0 👍", callback_data: `thumbsup-${getAnswers[j].id}` },
                                        { text: "0 👎", callback_data: `thumbsdown-${getAnswers[j].id}` },
                                        { text: "0 🤔", callback_data: `doubt-${getAnswers[j].id}` }
                                    ],
                                    [
                                        { text: "Load More", callback_data: `loadMoreComment-${qId}-${10}` }
                                    ]
                                ]
                            }
                        }
                    );
                } else {
                    await ctx.reply(
                        commentContent,
                        {
                            parse_mode: "MarkdownV2",
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: "0 👍", callback_data: `thumbsup-${getAnswers[j].id}` },
                                        { text: "0 👎", callback_data: `thumbsdown-${getAnswers[j].id}` },
                                        { text: "0 🤔", callback_data: `doubt-${getAnswers[j].id}` }
                                    ]
                                ]
                            }
                        }
                    );
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

    return await ctx.answerCbQuery("Successfully liked!");
});


bot.action(/thumbsdown-[0-9]+/, async (ctx) => {
    const string = ctx.update.callback_query.data;
    const commentId = string.replace(/\D/g, '');

    return await ctx.answerCbQuery("Successfully disliked!");
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
                { text: `Browse Answers 💬 (${approvedquestion.answersCount})`, url: link },
                { text: `Answer ➕`, url: addanswerLink, resize_keyboard: true },
            ],
        ]
    });


    //send to channel after checking if the object is voice or text
    if (approvedquestion.objectType == "text") {
        const content = `**${approvedquestion.text} \n\nBy: [${approvedquestion.displayName}](tg://user?id=${approvedquestion.fromUserId})**`;
        console.log(content);
        let channelPost = await ctx.telegram.sendMessage(
            process.env.dest_chan,
            content,
            {
                parse_mode: "MarkdownV2",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: `Browse Answers 💬 (${approvedquestion.answersCount})`, url: link },
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
        const content = `**By: [${approvedquestion.displayName}](tg://user?id=${approvedquestion.fromUserId})**`;
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
                            { text: `Browse Answers 💬 (${approvedquestion.answersCount})`, url: link },
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