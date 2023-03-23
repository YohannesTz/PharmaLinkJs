require("dotenv").config();

const { Telegraf } = require('telegraf');
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { message } = require('telegraf/filters');
const LocalSession = require('telegraf-session-local');

const bot = new Telegraf(process.env.token);
bot.use((new LocalSession({ database: 'database.json' })).middleware())

const adminGroup = process.env.admin_group;

let isUserAsking = false;
let chatId;


const welcomeText = `
Hi welcome to PharmaLink. a bot that allows you to ask questions with your
community. 
/start - to restart the bot
/ask - to ask a new question
/about - about the makers`;

bot.start((ctx) => ctx.reply(`Deep link payload: ${ctx.startPayload}`))

bot.start(async (ctx) => {

    if (ctx.startPayload) {
        return ctx.reply("Deeplink.");
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

bot.hears(/^\/start[ =](.+)$/, async (ctx) => {
    return await ctx.reply("asdfasd fasdf asd f")
})

bot.command("sth", async (ctx) => {
    console.log(ctx);
    await ctx.reply("sdfsdf")
});

bot.command("ask", async (ctx) => {
    chatId = ctx.chat.id;
    isUserAsking = true;
    //question_text = ctx.message.text;
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
    }
})

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
    await ctx.telegram.sendMessage(approvedquestion.questionChatId.toString(), "Your Question has been approved and posted! Thank you for your contribution!");

    const payload = { id: approvedquestion.id };
    const link = `https://t.me/${process.env.username}?start=${encodeURIComponent(JSON.stringify(payload))}`;

    //Update markup inline
    let res = await ctx.editMessageReplyMarkup({
        inline_keyboard: [
            [{ text: `Comments (${approvedquestion.answersCount})`, url: link }],
        ]
    });

    console.log(res);

    const content = `**${approvedquestion.text} \n\nBy: [${approvedquestion.displayName}](tg://user?id=${approvedquestion.fromUserId})**`;

    //send to channel
    await ctx.telegram.sendMessage(
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

function makeParsable(string) {
    const regex = /["'\\]/g; // regex for double quotes, single quotes, and backslashes
    const escape = '\\'; // escape character
    return string.replace(regex, match => escape + match); // replace matches with escape character and match
}

console.log("Bot started successfully!");
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));