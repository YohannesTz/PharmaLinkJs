require("dotenv").config();

const { Telegraf } = require('telegraf');
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { message } = require('telegraf/filters');
const LocalSession = require('telegraf-session-local');

const bot = new Telegraf(process.env.token);
//do not comment. the bot's watch will cause nodemon to restart indefinetly.only use if not using prisma/database
//bot.use((new LocalSession({ database: 'database.json' })).middleware()) 

const adminGroup = process.env.admin_group;

let isUserAsking = false;
let isUserAddingComment = false;
let commentQuestionId;
let chatId;


const welcomeText = `
Hi welcome to PharmaLink. a bot that allows you to ask questions with your
community. also join if you didn't already https://t.me/testchannelicreated
/start - to restart the bot
/ask - to ask a new question
/about - about the makers`;

bot.start(async (ctx) => {

    if (ctx.startPayload) {
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

        const content = `**${getQuestion.text} \n\nBy: [${getQuestion.displayName}](tg://user?id=${getQuestion.fromUserId})**`;

        await ctx.reply(
            content,
            {
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

        console.log("size: " + getAnswers.length);

        if (getAnswers.length < 5) {
            for (let i = 0; i < getAnswers.length; i++) {
                const commentContent = `${getAnswers[i].text}\n\n By [${getAnswers[i].displayName}](tg://user?id=${getAnswers[i].fromUserId})`;

                await ctx.reply(
                    commentContent,
                    {
                        parse_mode: "MarkdownV2",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "0 👍", callback_data: `thumbsup-${getAnswers[i].id}` },
                                    { text: "0 👎", callback_data: `thumbsdown-${getAnswers[i].id}` }
                                ]
                            ]
                        }
                    }
                );
            }
        } else {
            for (let j = 0; j < getAnswers.length; j++) {
                const commentContent = `${getAnswers[j].text}\n\nBy [${getAnswers[j].displayName}](tg://user?id=${getAnswers[j].fromUserId})`;
                console.log("index: " + j);
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
                                        { text: "0 👎", callback_data: `thumbsdown-${getAnswers[j].id}` }
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
                                        { text: "0 👎", callback_data: `thumbsdown-${getAnswers[j].id}` }
                                    ]
                                ]
                            }
                        }
                    );
                }
            }
        }

        return;
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
    chatId = ctx.chat.id;
    isUserAsking = true;
    return await ctx.reply("Send me your question, I will forward it to admins on behalf of you");
});

bot.on(message('text'), async (ctx) => {
    if (isUserAsking) {
        isUserAsking = false;

        const question_text = makeParsable(ctx.message.text);
        try {
            const newQuestion = await prisma.question.create({
                data: {
                    text: question_text,
                    isApproved: false,
                    fromUserId: ctx.message.from.id,
                    answersCount: 0,
                    questionChatId: chatId,
                    questionMessageId: ctx.message.message_id,
                    displayName: ctx.message.from.first_name
                }
            });

            console.log(newQuestion);

            const text = `**Question ${newQuestion.id} by [${newQuestion.displayName}](tg://user?id=${newQuestion.fromUserId})**`
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
    } else if (isUserAddingComment) {
        isUserAddingComment = false;

        try {
            const comment_text = makeParsable(ctx.message.text);

            await prisma.answer.create({
                data: {
                    text: comment_text,
                    fromUserId: ctx.message.from.id,
                    userId: ctx.message.from.id,
                    questionId: parseInt(commentQuestionId),
                    displayName: ctx.message.from.first_name
                }
            });

            const updateAnswerCount = await prisma.question.update({
                where: {
                    id: parseInt(commentQuestionId)
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

            await ctx.telegram.editMessageReplyMarkup(
                updateAnswerCount.questionChatId.toString(),
                updateAnswerCount.questionMessageId.toString(),
                undefined,
                {
                    inline_keyboard: [
                        [{ text: `Browse Answers 💬 (${updateAnswerCount.answersCount})`, url: link }],
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

    chatId = ctx.chat.id;
    isUserAddingComment = true;
    commentQuestionId = questionId;

    return await ctx.reply("send your answer.");
});

bot.action(/loadMoreComment-[0-9]+-[0-9]+/, async (ctx) => {
    const string = ctx.update.callback_query.data;
    const loadMoreCommentArgs = string.split("-")

    console.log(loadMoreCommentArgs[1] + ", " + loadMoreCommentArgs[2]);
    return await ctx.reply(loadMoreCommentArgs.toString());
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

    //Update markup inline
    await ctx.editMessageReplyMarkup({
        inline_keyboard: [
            [{ text: `Comments (${approvedquestion.answersCount})`, url: link }],
        ]
    });

    const content = `**${approvedquestion.text} \n\nBy: [${approvedquestion.displayName}](tg://user?id=${approvedquestion.fromUserId})**`;
    console.log(content);
    //send to channel
    const channelPost = await ctx.telegram.sendMessage(
        process.env.dest_chan,
        content,
        {
            parse_mode: "MarkdownV2",
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Comments (${approvedquestion.answersCount})`, url: link }],
                ]
            }
        }
    );

    console.log("=================");
    console.log(channelPost);
    console.log("=================");

    await prisma.question.update({
        data: {
            questionMessageId: channelPost.message_id,
            questionChatId: channelPost.chat.id
        },
        where: {
            id: approvedquestion.id
        }
    })

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