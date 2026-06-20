const {PermissionsBitField, EmbedBuilder, ButtonStyle, Client, GatewayIntentBits, ChannelType, Partials, ActionRowBuilder, SelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, SelectMenuInteraction, ButtonBuilder } = require("discord.js");
const Discord = require("discord.js")
const db = require("croxydb")

// Config yerine environment variables kullanıyoruz
const config = {
  token: process.env.TOKEN,
  channel: process.env.CHANNEL_ID,
  staff: process.env.STAFF_ROLE_ID,
  // Kategori ID'leri
  userReportCategory: process.env.USER_REPORT_CATEGORY_ID,
  purchaseCategory: process.env.PURCHASE_CATEGORY_ID,
  otherCategory: process.env.OTHER_CATEGORY_ID
};

const client = new Client({
  partials: [
    Partials.Message, // for message
    Partials.Channel, // for text channel
    Partials.GuildMember, // for guild member
    Partials.Reaction, // for message reaction
    Partials.GuildScheduledEvent, // for guild events
    Partials.User, // for discord user
    Partials.ThreadMember, // for thread member
  ],
  intents: [
    GatewayIntentBits.Guilds, // for guild related things
    GatewayIntentBits.GuildMembers, // for guild members related things
    GatewayIntentBits.GuildBans, // for manage guild bans
    GatewayIntentBits.GuildEmojisAndStickers, // for manage emojis and stickers
    GatewayIntentBits.GuildIntegrations, // for discord Integrations
    GatewayIntentBits.GuildWebhooks, // for discord webhooks
    GatewayIntentBits.GuildInvites, // for guild invite managing
    GatewayIntentBits.GuildVoiceStates, // for voice related things
    GatewayIntentBits.GuildPresences, // for user presence things
    GatewayIntentBits.GuildMessages, // for guild messages things
    GatewayIntentBits.GuildMessageReactions, // for message reactions things
    GatewayIntentBits.GuildMessageTyping, // for message typing things
    GatewayIntentBits.DirectMessages, // for dm messages
    GatewayIntentBits.DirectMessageReactions, // for dm message reaction
    GatewayIntentBits.DirectMessageTyping, // for dm message typinh
    GatewayIntentBits.MessageContent, // enable if you need message content things
  ],
});

module.exports = client;

// Render için port ayarı (web servisi gerekebilir)
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Basit bir HTTP endpoint (Render'ın bot'un çalıştığını anlaması için)
app.get('/', (req, res) => {
  res.send('Discord Bot is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

client.login(config.token)

client.on("ready", async() => {
  console.log(`Bot aktif! ${client.user.tag} olarak giriş yapıldı.`)
  
  // Slash command'ları kaydet
  const commands = [
    {
      name: 'setup-ticket',
      description: 'Destek sistemi mesajını gönder',
      default_member_permissions: '8' // Administrator permission
    }
  ];
  
  try {
    await client.application.commands.set(commands);
    console.log('Slash commands başarıyla kaydedildi!');
  } catch (error) {
    console.error('Slash commands kaydedilirken hata:', error);
  }
  
  // Otomatik mesaj gönderme (sadece bot ilk kez başlatıldığında)
  const supportMessageSent = db.get(`supportMessage_${client.user.id}`)
  if (supportMessageSent) {
    console.log("Destek mesajı zaten gönderilmiş. Manuel olarak tekrar göndermek için /setup-ticket kullanın.")
    return;
  }
  
  const channel = config.channel
  const as = client.channels.cache.get(channel)
  
  if (!as) {
    console.log("Kanal bulunamadı! CHANNEL_ID'yi kontrol edin.")
    return;
  }
  
  // Kanalda önceki destek mesajlarını kontrol et ve sil
  try {
    const messages = await as.messages.fetch({ limit: 50 });
    const botMessages = messages.filter(msg => 
      msg.author.id === client.user.id && 
      msg.embeds.length > 0 && 
      msg.embeds[0].author?.name?.includes("Destek Sistemi")
    );
    
    if (botMessages.size > 0) {
      console.log(`${botMessages.size} eski destek mesajı siliniyor...`);
      await Promise.all(botMessages.map(msg => msg.delete().catch(() => {})));
    }
  } catch (error) {
    console.log("Eski mesajları silerken hata:", error.message);
  }
  
  const embed = new EmbedBuilder()
  .setColor(0x127896)
  .setAuthor({ name: "Nova | Destek Sistemi", iconURL: as.guild.iconURL({ dynamic: true }) })
  .setDescription("Sunucumuzda destek oluşturabilmek için aşağıdaki butona basıp bir kategori seçmeniz gerekiyor.")
  .addFields(
       { name: '\u200B', value: '\u200B' },
       { name: "⚠️ Kullanıcı Bildir ", value: "Bir Kullanıcıyı Bildirmek İçin.", inline: true },
       { name: "💸 Satın Alım ", value: "Satın Alımlar İçin.", inline: true },
       { name: "⭐ Diğer ", value: "Diğer Sebepler İçin.", inline: true },
   )
   .setThumbnail(as.guild.iconURL({ dynamic: true, size: 256 }))
   .setFooter({ text: "discord.gg/novajb", iconURL: as.guild.iconURL({ dynamic: true }) })

  const row = new Discord.ActionRowBuilder()
  .addComponents(
    new Discord.ButtonBuilder()
    .setLabel("Destek Talebi Oluştur")
    .setStyle(Discord.ButtonStyle.Secondary)
    .setCustomId("destek")
    .setEmoji("🎫")
  )
  
  try {
    await as.send({embeds: [embed], components:[row]});
    // Mesajın gönderildiğini veritabanına kaydet (24 saat için)
    db.set(`supportMessage_${client.user.id}`, Date.now(), 86400000); // 24 saat
    console.log("Destek mesajı başarıyla gönderildi.");
  } catch (error) {
    console.error("Destek mesajı gönderilirken hata:", error);
  }
})

client.on("interactionCreate", async(interaction) => {
  try {
    // Slash command handler
    if (interaction.isCommand()) {
      if (interaction.commandName === 'setup-ticket') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return await interaction.reply({ content: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekiyor!', ephemeral: true });
        }
        
        const channel = interaction.channel;
        
        // Kanalda önceki destek mesajlarını sil
        try {
          const messages = await channel.messages.fetch({ limit: 50 });
          const botMessages = messages.filter(msg => 
            msg.author.id === client.user.id && 
            msg.embeds.length > 0 && 
            msg.embeds[0].author?.name?.includes("Destek Sistemi")
          );
          
          if (botMessages.size > 0) {
            await Promise.all(botMessages.map(msg => msg.delete().catch(() => {})));
          }
        } catch (error) {
          console.log("Eski mesajları silerken hata:", error.message);
        }
        
        const embed = new EmbedBuilder()
        .setColor(0x127896)
        .setAuthor({ name: "Nova | Destek Sistemi", iconURL: interaction.guild.iconURL({ dynamic: true }) })
        .setDescription("Sunucumuzda destek oluşturabilmek için aşağıdaki butona basıp bir kategori seçmeniz gerekiyor.")
        .addFields(
             { name: '\u200B', value: '\u200B' },
             { name: "⚠️ Kullanıcı Bildir ", value: "Bir Kullanıcıyı Bildirmek İçin.", inline: true },
             { name: "💸 Satın Alım ", value: "Satın Alımlar İçin.", inline: true },
             { name: "⭐ Diğer ", value: "Diğer Sebepler İçin.", inline: true },
         )
         .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }))
         .setFooter({ text: "discord.gg/novajb", iconURL: interaction.guild.iconURL({ dynamic: true }) })

        const row = new Discord.ActionRowBuilder()
        .addComponents(
          new Discord.ButtonBuilder()
          .setLabel("Destek Talebi Oluştur")
          .setStyle(Discord.ButtonStyle.Secondary)
          .setCustomId("destek")
          .setEmoji("🎫")
        )
        
        await channel.send({embeds: [embed], components:[row]});
        await interaction.reply({ content: 'Destek sistemi mesajı başarıyla gönderildi!', ephemeral: true });
        return;
      }
    }
    
    if(interaction.customId === "destek") {
      const row = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
        .setEmoji("⚠️")
        .setStyle(Discord.ButtonStyle.Danger)  // Kırmızı
        .setCustomId("Kullanıcı Bildir"), 
        new Discord.ButtonBuilder()
        .setEmoji("💸")
        .setStyle(Discord.ButtonStyle.Success)  // Yeşil
        .setCustomId("Satın Alım"),
        new Discord.ButtonBuilder()
        .setEmoji("⭐")
        .setStyle(Discord.ButtonStyle.Primary)  // Mavi
        .setCustomId("Diğer Sebepler"),
      )
      
      const embed = new EmbedBuilder()
      .setDescription("Hangi kategoriyi seçmek istiyorsun?")
      .setColor(0x127896)
      
      return await interaction.reply({embeds: [embed], components: [row], ephemeral: true})
    }

    const butonlar = ["Kullanıcı Bildir","Satın Alım","Diğer Sebepler"]
    if(butonlar.includes(interaction.customId)) {
      if (interaction.replied || interaction.deferred) return;
      
      await interaction.deferUpdate()
      const data = db.get(`ticket_${interaction.guild.id}`) || 1
      
      // Kategori seçme
      let categoryId;
      switch(interaction.customId) {
        case "Kullanıcı Bildir":
          categoryId = config.userReportCategory;
          break;
        case "Satın Alım":
          categoryId = config.purchaseCategory;
          break;
        case "Diğer Sebepler":
          categoryId = config.otherCategory;
          break;
      }
      
      // Kullanıcı adını temizle (Discord kanal ismi kurallarına uygun hale getir)
      const cleanUsername = interaction.user.username
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') // Özel karakterleri tire ile değiştir
        .replace(/-+/g, '-') // Birden fazla tireyi tek tire yap
        .replace(/^-|-$/g, ''); // Başındaki ve sonundaki tireleri kaldır
      
      const channelOptions = {
        name: `ticket-${cleanUsername}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: config.staff,
            allow: [PermissionsBitField.Flags.ViewChannel]
          },
        ]
      };
      
      // Eğer kategori ID'si varsa ekle
      if (categoryId) {
        channelOptions.parent = categoryId;
      }
      
      const channel = await interaction.guild.channels.create(channelOptions)
      
      const embed = new EmbedBuilder()
      .setAuthor({name: "Nova - Destek Sistemi!", iconURL: interaction.guild.iconURL()})
      .setDescription("Hey, destek talebi açtığına göre önemli bir konu olmalı. Bu sürede birini etiketleme ve sakince sorununu belirt.")
      .addFields(
        { name: '\u200B', value: '\u200B' },
        {name: "Kullanıcı:", value: `${interaction.user.tag}`, inline: true},
        {name: "Sebep:", value: `${interaction.customId}`, inline: true},
        {name: "Destek Sırası:", value: `${data}`, inline: true}
      )
      .setColor(0x127896)
      
      const row = new ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
        .setEmoji("📑")
        .setLabel("Kaydet Ve Kapat")
        .setStyle(Discord.ButtonStyle.Secondary)
        .setCustomId("kapat"),
        new Discord.ButtonBuilder()
        .setEmoji("📋")
        .setLabel("Mesajlar")
        .setStyle(Discord.ButtonStyle.Secondary)
        .setCustomId("mesaj")
      )
      
      db.set(`kapat_${channel.id}`, interaction.user.id)
      db.add(`ticket_${interaction.guild.id}`, 1)
      
      const message = await channel.send({embeds: [embed], components: [row]})
      await message.pin().catch(console.error)
    }
    
    if(interaction.customId === "kapat") {
      if (interaction.replied || interaction.deferred) return;
      
      const channel = interaction.channel
      
      const embed = new EmbedBuilder()
      .setDescription("Bu destek talebi sonlandırıldı, umarım sorun çözülmüştür :)\n\n**Kanal 5 saniye sonra silinecek...**")
      .setColor(0x127896)
      
      await interaction.reply({embeds: [embed]})
      
      // 5 saniye bekleyip kanalı sil
      setTimeout(async () => {
        try {
          // Mesaj geçmişini temizle (veritabanından)
          db.delete(`mesaj_${channel.id}`)
          db.delete(`kapat_${channel.id}`)
          
          // Kanalı sil
          await channel.delete("Destek talebi kapatıldı")
          console.log(`Ticket kanalı silindi: ${channel.name}`)
        } catch (error) {
          console.error("Kanal silinirken hata oluştu:", error)
        }
      }, 5000)
    }
    
  } catch (error) {
    console.error("Interaction hatası:", error)
  }
})

client.on("messageCreate", async(message) => {
  if(message.channel.name.includes("ticket")) {
    if(message.author?.bot) return;
    db.push(`mesaj_${message.channel.id}`, `${message.author.username}: ${message.content}`)
  }
})

client.on("interactionCreate", async(message) => {
  if(message.customId === "mesaj") {
    if (message.replied || message.deferred) return;
    
    const fs = require("fs")
    const datas = db.fetch(`mesaj_${message.channel.id}`)
    
    if(!datas) {
      fs.writeFileSync(`${message.channel.id}.json`, "Bu kanalda hiç bir mesaj bulunamadı!");
      await message.reply({files: [`${message.channel.id}.json`]}).catch(console.error)
    } else {
      const data = db.fetch(`mesaj_${message.channel.id}`).join("\n")
      fs.writeFileSync(`${message.channel.id}.json`, data);
      await message.reply({files: [`${message.channel.id}.json`]}).catch(console.error)
    }
  }
})

// Hata yakalama
process.on("unhandledRejection", async(error) => {
  console.log("Bir hata oluştu: " + error)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully.');
  client.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully.');
  client.destroy();
  process.exit(0);
});
