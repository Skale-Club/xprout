/**
 * Guest-facing texts of the AI chat box and the "call the waiter" buttons, in
 * every menu language (menu-i18n.ts holds the rest of the menu's copy).
 * Placeholders: {name} restaurant, {s} seconds, {n} count.
 */

export interface GuestCopy {
  openChat: string
  close: string
  askName: string
  aiAssistant: string
  gateTitle: string
  gateBody: string
  startChat: string
  starting: string
  couldNotStart: string
  welcomeText: string
  welcomeVoice: string
  somethingWrong: string
  micUnsupported: string
  micDenied: string
  transcriptionFailed: string
  heardNothing: string
  viewCart: string
  remainingToday: string
  discardRecording: string
  stopAndSend: string
  transcribing: string
  sending: string
  tapToRecord: string
  typeOrRecord: string
  askMenu: string
  recordVoice: string
  send: string
  callWaiter: string
  askBill: string
  waiterCalled: string
  billRequested: string
  callFailed: string
  /** "From $15.00": the lowest price of a dish with sizes. */
  fromPrice: string
  contactTitle: string
  callRestaurant: string
  whatsappAsk: string
  todayHours: string
  closedNextHours: string
  welcomeVoiceBrowse: string
  /** Chat sheet: gate title, client-side greeting and its suggestion chips. */
  chatWith: string
  greeting: string
  greetingBrowse: string
  suggestRecommend: string
  suggestPopular: string
  suggestOrder: string
  suggestSpecials: string
  addedLabel: string
  /** A cart line the assistant changed / removed, and the "team notified" card. */
  cartUpdatedLabel: string
  cartRemovedLabel: string
  staffNotified: string
  expandChat: string
  shrinkChat: string
  /** Sign-in gate, inactivity and per-conversation limit notes of the chat. */
  signInPrompt: string
  signInButton: string
  conversationExpired: string
  conversationLimit: string
  newConversation: string
}

const en: GuestCopy = {
  openChat: 'Open AI chat', close: 'Close', askName: 'Ask {name}', aiAssistant: 'AI menu assistant',
  gateTitle: 'Chat with our AI assistant', gateBody: 'Share your phone number to start. We use it only to keep your conversation tied to you.',
  startChat: 'Start chat', starting: 'Starting…', couldNotStart: 'Could not start the chat',
  welcomeText: "Hi! I'm the {name} menu assistant. Ask me anything about our dishes — pairings, ingredients, recommendations — or tell me what you're in the mood for and I'll suggest something.",
  welcomeVoice: "Hi! I'm the {name} menu assistant. Tap the microphone and tell me what you'd like — ask about our dishes or just say your order.",
  somethingWrong: 'Something went wrong', micUnsupported: 'Microphone not supported on this browser', micDenied: 'Microphone permission denied',
  transcriptionFailed: 'Transcription failed', heardNothing: "Couldn't hear anything in that recording. Try again a little closer to the microphone.",
  viewCart: 'View cart', remainingToday: '{n} messages left today', discardRecording: 'Discard recording', stopAndSend: 'Stop and send voice message',
  transcribing: 'Transcribing your voice note…', sending: 'Sending…', tapToRecord: 'Tap to record · up to {s} s',
  typeOrRecord: 'Type or record your order…', askMenu: 'Ask about our menu…', recordVoice: 'Record a voice message (up to {s} seconds)', send: 'Send',
  callWaiter: 'Call waiter', askBill: 'Ask for the bill', waiterCalled: 'A waiter is on the way', billRequested: 'The bill is on the way',
  callFailed: "Couldn't reach the staff. Please try again.",
  fromPrice: "From {price}", contactTitle: "Questions? Contact the restaurant", callRestaurant: "Call", whatsappAsk: "Hi! I'd like to know more about {item}", todayHours: "Today: {text}", closedNextHours: "Closed · {day}: {text}",
  welcomeVoiceBrowse: "Hi! I'm the {name} menu assistant. Tap the microphone and ask me anything about our dishes.",
  chatWith: "Chat with {name}",
  greeting: "Hi! I can help you choose dishes, explain ingredients and add items to your order.",
  greetingBrowse: "Hi! I can help you choose dishes and explain ingredients.",
  suggestRecommend: "What do you recommend?",
  suggestPopular: "What's popular here?",
  suggestOrder: "Help me order",
  suggestSpecials: "Tell me about the specials",
  addedLabel: "Added",
  cartUpdatedLabel: "Updated",
  cartRemovedLabel: "Removed",
  staffNotified: "We've let the team know",
  expandChat: "Expand chat",
  shrinkChat: "Shrink chat",
  signInPrompt: "Sign in with your phone to chat. We send you a code by SMS.",
  signInButton: "Sign in with your phone",
  conversationExpired: "Conversation closed for inactivity.",
  conversationLimit: "This conversation reached its message limit.",
  newConversation: "New conversation",
}

const pt: GuestCopy = {
  openChat: 'Abrir chat com IA', close: 'Fechar', askName: 'Pergunte ao {name}', aiAssistant: 'Assistente do cardápio',
  gateTitle: 'Converse com nosso assistente', gateBody: 'Informe seu telefone para começar. Usamos só para manter a conversa ligada a você.',
  startChat: 'Começar', starting: 'Iniciando…', couldNotStart: 'Não foi possível iniciar o chat',
  welcomeText: 'Oi! Sou o assistente do cardápio do {name}. Pergunte o que quiser sobre os pratos — combinações, ingredientes, sugestões — ou diga do que está com vontade que eu indico algo.',
  welcomeVoice: 'Oi! Sou o assistente do cardápio do {name}. Toque no microfone e diga o que deseja — pergunte sobre os pratos ou já fale seu pedido.',
  somethingWrong: 'Algo deu errado', micUnsupported: 'Este navegador não permite usar o microfone', micDenied: 'Permissão do microfone negada',
  transcriptionFailed: 'Não foi possível transcrever', heardNothing: 'Não deu para ouvir nada na gravação. Tente de novo mais perto do microfone.',
  viewCart: 'Ver carrinho', remainingToday: '{n} mensagens restantes hoje', discardRecording: 'Descartar gravação', stopAndSend: 'Parar e enviar áudio',
  transcribing: 'Transcrevendo seu áudio…', sending: 'Enviando…', tapToRecord: 'Toque para gravar · até {s} s',
  typeOrRecord: 'Digite ou grave seu pedido…', askMenu: 'Pergunte sobre o cardápio…', recordVoice: 'Gravar áudio (até {s} segundos)', send: 'Enviar',
  callWaiter: 'Chamar garçom', askBill: 'Pedir a conta', waiterCalled: 'Um garçom está a caminho', billRequested: 'A conta está a caminho',
  callFailed: 'Não conseguimos avisar a equipe. Tente de novo.',
  fromPrice: "A partir de {price}", contactTitle: "Dúvidas? Fale com o restaurante", callRestaurant: "Ligar", whatsappAsk: "Olá! Gostaria de saber mais sobre {item}", todayHours: "Hoje: {text}", closedNextHours: "Fechado · {day}: {text}",
  welcomeVoiceBrowse: "Oi! Sou o assistente do cardápio do {name}. Toque no microfone e pergunte o que quiser sobre os pratos.",
  chatWith: "Converse com {name}",
  greeting: "Oi! Posso ajudar você a escolher pratos, explicar ingredientes e adicionar itens ao pedido.",
  greetingBrowse: "Oi! Posso ajudar você a escolher pratos e explicar ingredientes.",
  suggestRecommend: "O que você recomenda?",
  suggestPopular: "O que é mais pedido aqui?",
  suggestOrder: "Me ajude a pedir",
  suggestSpecials: "Fale das sugestões do dia",
  addedLabel: "Adicionado",
  cartUpdatedLabel: "Atualizado",
  cartRemovedLabel: "Removido",
  staffNotified: "Avisamos a equipe",
  expandChat: "Expandir conversa",
  shrinkChat: "Reduzir conversa",
  signInPrompt: "Entre com seu celular para conversar. Enviamos um código por SMS.",
  signInButton: "Entrar com celular",
  conversationExpired: "Conversa encerrada por inatividade.",
  conversationLimit: "Esta conversa chegou ao limite de mensagens.",
  newConversation: "Nova conversa",
}

const es: GuestCopy = {
  openChat: 'Abrir chat con IA', close: 'Cerrar', askName: 'Pregunta a {name}', aiAssistant: 'Asistente del menú',
  gateTitle: 'Habla con nuestro asistente', gateBody: 'Indica tu teléfono para empezar. Solo lo usamos para mantener la conversación asociada a ti.',
  startChat: 'Empezar', starting: 'Iniciando…', couldNotStart: 'No se pudo iniciar el chat',
  welcomeText: '¡Hola! Soy el asistente del menú de {name}. Pregúntame lo que quieras sobre los platos — maridajes, ingredientes, recomendaciones — o dime qué te apetece y te sugiero algo.',
  welcomeVoice: '¡Hola! Soy el asistente del menú de {name}. Toca el micrófono y dime qué quieres — pregunta por los platos o di tu pedido.',
  somethingWrong: 'Algo salió mal', micUnsupported: 'Este navegador no admite el micrófono', micDenied: 'Permiso del micrófono denegado',
  transcriptionFailed: 'No se pudo transcribir', heardNothing: 'No se oyó nada en la grabación. Inténtalo de nuevo más cerca del micrófono.',
  viewCart: 'Ver carrito', remainingToday: 'Te quedan {n} mensajes hoy', discardRecording: 'Descartar grabación', stopAndSend: 'Detener y enviar audio',
  transcribing: 'Transcribiendo tu audio…', sending: 'Enviando…', tapToRecord: 'Toca para grabar · hasta {s} s',
  typeOrRecord: 'Escribe o graba tu pedido…', askMenu: 'Pregunta por el menú…', recordVoice: 'Grabar audio (hasta {s} segundos)', send: 'Enviar',
  callWaiter: 'Llamar al camarero', askBill: 'Pedir la cuenta', waiterCalled: 'Un camarero va en camino', billRequested: 'La cuenta va en camino',
  callFailed: 'No pudimos avisar al personal. Inténtalo de nuevo.',
  fromPrice: "Desde {price}", contactTitle: "¿Dudas? Contacta con el restaurante", callRestaurant: "Llamar", whatsappAsk: "¡Hola! Me gustaría saber más sobre {item}", todayHours: "Hoy: {text}", closedNextHours: "Cerrado · {day}: {text}",
  welcomeVoiceBrowse: "¡Hola! Soy el asistente del menú de {name}. Toca el micrófono y pregúntame lo que quieras sobre los platos.",
  chatWith: "Chatea con {name}",
  greeting: "¡Hola! Puedo ayudarte a elegir platos, explicar ingredientes y añadir productos a tu pedido.",
  greetingBrowse: "¡Hola! Puedo ayudarte a elegir platos y explicar ingredientes.",
  suggestRecommend: "¿Qué me recomiendas?",
  suggestPopular: "¿Qué es lo más popular?",
  suggestOrder: "Ayúdame a pedir",
  suggestSpecials: "Cuéntame las especialidades",
  addedLabel: "Añadido",
  cartUpdatedLabel: "Actualizado",
  cartRemovedLabel: "Quitado",
  staffNotified: "Hemos avisado al equipo",
  expandChat: "Ampliar el chat",
  shrinkChat: "Reducir el chat",
  signInPrompt: "Inicia sesión con tu móvil para chatear. Te enviamos un código por SMS.",
  signInButton: "Entrar con el móvil",
  conversationExpired: "Conversación cerrada por inactividad.",
  conversationLimit: "Esta conversación alcanzó el límite de mensajes.",
  newConversation: "Nueva conversación",
}

const fr: GuestCopy = {
  openChat: 'Ouvrir le chat IA', close: 'Fermer', askName: 'Demandez à {name}', aiAssistant: 'Assistant du menu',
  gateTitle: 'Discutez avec notre assistant', gateBody: 'Indiquez votre numéro pour commencer. Il sert uniquement à rattacher la conversation à vous.',
  startChat: 'Commencer', starting: 'Démarrage…', couldNotStart: 'Impossible de démarrer le chat',
  welcomeText: "Bonjour ! Je suis l'assistant du menu de {name}. Posez-moi vos questions sur nos plats — accords, ingrédients, conseils — ou dites-moi ce qui vous ferait envie.",
  welcomeVoice: "Bonjour ! Je suis l'assistant du menu de {name}. Touchez le micro et dites-moi ce que vous voulez — une question ou directement votre commande.",
  somethingWrong: "Une erreur s'est produite", micUnsupported: 'Micro non pris en charge par ce navigateur', micDenied: 'Accès au micro refusé',
  transcriptionFailed: 'Transcription impossible', heardNothing: "Rien n'a été entendu. Réessayez un peu plus près du micro.",
  viewCart: 'Voir le panier', remainingToday: "{n} messages restants aujourd'hui", discardRecording: "Supprimer l'enregistrement", stopAndSend: 'Arrêter et envoyer le message vocal',
  transcribing: 'Transcription en cours…', sending: 'Envoi…', tapToRecord: "Touchez pour enregistrer · jusqu'à {s} s",
  typeOrRecord: 'Écrivez ou dictez votre commande…', askMenu: 'Une question sur le menu…', recordVoice: "Enregistrer un message vocal (jusqu'à {s} secondes)", send: 'Envoyer',
  callWaiter: 'Appeler un serveur', askBill: "Demander l'addition", waiterCalled: 'Un serveur arrive', billRequested: "L'addition arrive",
  callFailed: "Impossible de prévenir l'équipe. Réessayez.",
  fromPrice: "À partir de {price}", contactTitle: "Une question ? Contactez le restaurant", callRestaurant: "Appeler", whatsappAsk: "Bonjour ! J'aimerais en savoir plus sur {item}", todayHours: "Aujourd'hui : {text}", closedNextHours: "Fermé · {day} : {text}",
  welcomeVoiceBrowse: "Bonjour ! Je suis l'assistant du menu de {name}. Touchez le micro et posez-moi vos questions sur nos plats.",
  chatWith: "Discutez avec {name}",
  greeting: "Bonjour ! Je peux vous aider à choisir des plats, expliquer les ingrédients et ajouter des articles à votre commande.",
  greetingBrowse: "Bonjour ! Je peux vous aider à choisir des plats et expliquer les ingrédients.",
  suggestRecommend: "Que me conseillez-vous ?",
  suggestPopular: "Qu'est-ce qui est populaire ici ?",
  suggestOrder: "Aidez-moi à commander",
  suggestSpecials: "Parlez-moi des spécialités",
  addedLabel: "Ajouté",
  cartUpdatedLabel: "Mis à jour",
  cartRemovedLabel: "Retiré",
  staffNotified: "Nous avons prévenu l'équipe",
  expandChat: "Agrandir le chat",
  shrinkChat: "Réduire le chat",
  signInPrompt: "Connectez-vous avec votre téléphone pour discuter. Nous vous envoyons un code par SMS.",
  signInButton: "Se connecter avec le téléphone",
  conversationExpired: "Conversation fermée pour inactivité.",
  conversationLimit: "Cette conversation a atteint sa limite de messages.",
  newConversation: "Nouvelle conversation",
}

const de: GuestCopy = {
  openChat: 'KI-Chat öffnen', close: 'Schließen', askName: 'Frag {name}', aiAssistant: 'KI-Menüassistent',
  gateTitle: 'Chatte mit unserem Assistenten', gateBody: 'Gib deine Telefonnummer ein, um zu starten. Wir nutzen sie nur, um das Gespräch dir zuzuordnen.',
  startChat: 'Chat starten', starting: 'Wird gestartet…', couldNotStart: 'Chat konnte nicht gestartet werden',
  welcomeText: 'Hallo! Ich bin der Menüassistent von {name}. Frag mich alles zu unseren Gerichten — Kombinationen, Zutaten, Empfehlungen — oder sag mir, worauf du Lust hast.',
  welcomeVoice: 'Hallo! Ich bin der Menüassistent von {name}. Tippe auf das Mikrofon und sag, was du möchtest — eine Frage oder direkt deine Bestellung.',
  somethingWrong: 'Etwas ist schiefgelaufen', micUnsupported: 'Mikrofon wird in diesem Browser nicht unterstützt', micDenied: 'Mikrofonzugriff verweigert',
  transcriptionFailed: 'Transkription fehlgeschlagen', heardNothing: 'In der Aufnahme war nichts zu hören. Versuch es näher am Mikrofon.',
  viewCart: 'Warenkorb ansehen', remainingToday: 'Noch {n} Nachrichten heute', discardRecording: 'Aufnahme verwerfen', stopAndSend: 'Stoppen und Sprachnachricht senden',
  transcribing: 'Sprachnachricht wird transkribiert…', sending: 'Wird gesendet…', tapToRecord: 'Zum Aufnehmen tippen · bis {s} s',
  typeOrRecord: 'Bestellung tippen oder aufnehmen…', askMenu: 'Frag etwas zum Menü…', recordVoice: 'Sprachnachricht aufnehmen (bis {s} Sekunden)', send: 'Senden',
  callWaiter: 'Kellner rufen', askBill: 'Rechnung bitte', waiterCalled: 'Ein Kellner ist unterwegs', billRequested: 'Die Rechnung kommt',
  callFailed: 'Das Personal konnte nicht benachrichtigt werden. Bitte erneut versuchen.',
  fromPrice: "Ab {price}", contactTitle: "Fragen? Kontaktiere das Restaurant", callRestaurant: "Anrufen", whatsappAsk: "Hallo! Ich hätte gern mehr Infos zu {item}", todayHours: "Heute: {text}", closedNextHours: "Geschlossen · {day}: {text}",
  welcomeVoiceBrowse: "Hallo! Ich bin der Menü-Assistent von {name}. Tippe auf das Mikrofon und frag mich alles über unsere Gerichte.",
  chatWith: "Chatte mit {name}",
  greeting: "Hallo! Ich helfe dir bei der Auswahl, erkläre Zutaten und lege Artikel in deine Bestellung.",
  greetingBrowse: "Hallo! Ich helfe dir bei der Auswahl und erkläre Zutaten.",
  suggestRecommend: "Was empfiehlst du?",
  suggestPopular: "Was ist hier beliebt?",
  suggestOrder: "Hilf mir beim Bestellen",
  suggestSpecials: "Erzähl mir von den Spezialitäten",
  addedLabel: "Hinzugefügt",
  cartUpdatedLabel: "Aktualisiert",
  cartRemovedLabel: "Entfernt",
  staffNotified: "Wir haben das Team informiert",
  expandChat: "Chat vergrößern",
  shrinkChat: "Chat verkleinern",
  signInPrompt: "Melde dich mit deinem Handy an, um zu chatten. Wir senden dir einen Code per SMS.",
  signInButton: "Mit Handy anmelden",
  conversationExpired: "Unterhaltung wegen Inaktivität beendet.",
  conversationLimit: "Diese Unterhaltung hat das Nachrichtenlimit erreicht.",
  newConversation: "Neue Unterhaltung",
}

const it: GuestCopy = {
  openChat: 'Apri la chat IA', close: 'Chiudi', askName: 'Chiedi a {name}', aiAssistant: 'Assistente del menù',
  gateTitle: 'Chatta con il nostro assistente', gateBody: 'Inserisci il tuo numero per iniziare. Lo usiamo solo per collegare la conversazione a te.',
  startChat: 'Inizia', starting: 'Avvio…', couldNotStart: 'Impossibile avviare la chat',
  welcomeText: "Ciao! Sono l'assistente del menù di {name}. Chiedimi qualsiasi cosa sui piatti — abbinamenti, ingredienti, consigli — o dimmi cosa ti va e ti suggerisco qualcosa.",
  welcomeVoice: "Ciao! Sono l'assistente del menù di {name}. Tocca il microfono e dimmi cosa desideri — una domanda o direttamente l'ordine.",
  somethingWrong: 'Qualcosa è andato storto', micUnsupported: 'Microfono non supportato da questo browser', micDenied: 'Permesso del microfono negato',
  transcriptionFailed: 'Trascrizione non riuscita', heardNothing: 'Non si è sentito nulla. Riprova più vicino al microfono.',
  viewCart: 'Vedi carrello', remainingToday: '{n} messaggi rimasti oggi', discardRecording: 'Elimina registrazione', stopAndSend: 'Ferma e invia il vocale',
  transcribing: 'Trascrizione del vocale…', sending: 'Invio…', tapToRecord: 'Tocca per registrare · fino a {s} s',
  typeOrRecord: "Scrivi o registra l'ordine…", askMenu: 'Chiedi del menù…', recordVoice: 'Registra un vocale (fino a {s} secondi)', send: 'Invia',
  callWaiter: 'Chiama il cameriere', askBill: 'Chiedi il conto', waiterCalled: 'Un cameriere sta arrivando', billRequested: 'Il conto sta arrivando',
  callFailed: 'Non siamo riusciti ad avvisare il personale. Riprova.',
  fromPrice: "Da {price}", contactTitle: "Domande? Contatta il ristorante", callRestaurant: "Chiama", whatsappAsk: "Ciao! Vorrei sapere di più su {item}", todayHours: "Oggi: {text}", closedNextHours: "Chiuso · {day}: {text}",
  welcomeVoiceBrowse: "Ciao! Sono l'assistente del menu di {name}. Tocca il microfono e chiedimi qualsiasi cosa sui nostri piatti.",
  chatWith: "Chatta con {name}",
  greeting: "Ciao! Posso aiutarti a scegliere i piatti, spiegare gli ingredienti e aggiungere articoli al tuo ordine.",
  greetingBrowse: "Ciao! Posso aiutarti a scegliere i piatti e spiegare gli ingredienti.",
  suggestRecommend: "Cosa mi consigli?",
  suggestPopular: "Cosa va per la maggiore qui?",
  suggestOrder: "Aiutami a ordinare",
  suggestSpecials: "Parlami delle specialità",
  addedLabel: "Aggiunto",
  cartUpdatedLabel: "Aggiornato",
  cartRemovedLabel: "Rimosso",
  staffNotified: "Abbiamo avvisato il team",
  expandChat: "Espandi la chat",
  shrinkChat: "Riduci la chat",
  signInPrompt: "Accedi con il tuo cellulare per chattare. Ti inviamo un codice via SMS.",
  signInButton: "Accedi con il cellulare",
  conversationExpired: "Conversazione chiusa per inattività.",
  conversationLimit: "Questa conversazione ha raggiunto il limite di messaggi.",
  newConversation: "Nuova conversazione",
}

const nl: GuestCopy = {
  openChat: 'AI-chat openen', close: 'Sluiten', askName: 'Vraag {name}', aiAssistant: 'AI-menuassistent',
  gateTitle: 'Chat met onze assistent', gateBody: 'Vul je telefoonnummer in om te beginnen. We gebruiken het alleen om het gesprek aan jou te koppelen.',
  startChat: 'Chat starten', starting: 'Starten…', couldNotStart: 'Chat kon niet worden gestart',
  welcomeText: 'Hoi! Ik ben de menuassistent van {name}. Vraag me alles over onze gerechten — combinaties, ingrediënten, tips — of zeg waar je zin in hebt.',
  welcomeVoice: 'Hoi! Ik ben de menuassistent van {name}. Tik op de microfoon en zeg wat je wilt — een vraag of meteen je bestelling.',
  somethingWrong: 'Er ging iets mis', micUnsupported: 'Microfoon wordt niet ondersteund in deze browser', micDenied: 'Toegang tot microfoon geweigerd',
  transcriptionFailed: 'Transcriptie mislukt', heardNothing: 'Er was niets te horen. Probeer het dichter bij de microfoon.',
  viewCart: 'Winkelwagen bekijken', remainingToday: 'Nog {n} berichten vandaag', discardRecording: 'Opname verwijderen', stopAndSend: 'Stoppen en spraakbericht versturen',
  transcribing: 'Spraakbericht wordt uitgeschreven…', sending: 'Versturen…', tapToRecord: 'Tik om op te nemen · tot {s} s',
  typeOrRecord: 'Typ of spreek je bestelling in…', askMenu: 'Vraag iets over het menu…', recordVoice: 'Spraakbericht opnemen (tot {s} seconden)', send: 'Versturen',
  callWaiter: 'Ober roepen', askBill: 'Om de rekening vragen', waiterCalled: 'Er komt een ober aan', billRequested: 'De rekening komt eraan',
  callFailed: 'We konden het personeel niet bereiken. Probeer het opnieuw.',
  fromPrice: "Vanaf {price}", contactTitle: "Vragen? Neem contact op met het restaurant", callRestaurant: "Bellen", whatsappAsk: "Hallo! Ik wil graag meer weten over {item}", todayHours: "Vandaag: {text}", closedNextHours: "Gesloten · {day}: {text}",
  welcomeVoiceBrowse: "Hallo! Ik ben de menu-assistent van {name}. Tik op de microfoon en vraag me alles over onze gerechten.",
  chatWith: "Chat met {name}",
  greeting: "Hoi! Ik help je gerechten kiezen, leg ingrediënten uit en voeg items toe aan je bestelling.",
  greetingBrowse: "Hoi! Ik help je gerechten kiezen en leg ingrediënten uit.",
  suggestRecommend: "Wat raad je aan?",
  suggestPopular: "Wat is hier populair?",
  suggestOrder: "Help me bestellen",
  suggestSpecials: "Vertel me over de specialiteiten",
  addedLabel: "Toegevoegd",
  cartUpdatedLabel: "Bijgewerkt",
  cartRemovedLabel: "Verwijderd",
  staffNotified: "We hebben het team op de hoogte gebracht",
  expandChat: "Chat vergroten",
  shrinkChat: "Chat verkleinen",
  signInPrompt: "Log in met je telefoon om te chatten. We sturen je een code per sms.",
  signInButton: "Inloggen met telefoon",
  conversationExpired: "Gesprek gesloten wegens inactiviteit.",
  conversationLimit: "Dit gesprek heeft de berichtlimiet bereikt.",
  newConversation: "Nieuw gesprek",
}

const pl: GuestCopy = {
  openChat: 'Otwórz czat AI', close: 'Zamknij', askName: 'Zapytaj {name}', aiAssistant: 'Asystent menu',
  gateTitle: 'Porozmawiaj z naszym asystentem', gateBody: 'Podaj numer telefonu, aby zacząć. Używamy go tylko, by powiązać rozmowę z Tobą.',
  startChat: 'Rozpocznij', starting: 'Uruchamianie…', couldNotStart: 'Nie udało się rozpocząć czatu',
  welcomeText: 'Cześć! Jestem asystentem menu {name}. Zapytaj o dania — połączenia, składniki, polecenia — albo powiedz, na co masz ochotę.',
  welcomeVoice: 'Cześć! Jestem asystentem menu {name}. Dotknij mikrofonu i powiedz, czego chcesz — zadaj pytanie albo od razu złóż zamówienie.',
  somethingWrong: 'Coś poszło nie tak', micUnsupported: 'Ta przeglądarka nie obsługuje mikrofonu', micDenied: 'Brak zgody na mikrofon',
  transcriptionFailed: 'Transkrypcja nie powiodła się', heardNothing: 'Nic nie było słychać. Spróbuj bliżej mikrofonu.',
  viewCart: 'Zobacz koszyk', remainingToday: 'Pozostało dziś wiadomości: {n}', discardRecording: 'Odrzuć nagranie', stopAndSend: 'Zatrzymaj i wyślij wiadomość głosową',
  transcribing: 'Przepisywanie nagrania…', sending: 'Wysyłanie…', tapToRecord: 'Dotknij, aby nagrać · do {s} s',
  typeOrRecord: 'Wpisz lub nagraj zamówienie…', askMenu: 'Zapytaj o menu…', recordVoice: 'Nagraj wiadomość głosową (do {s} sekund)', send: 'Wyślij',
  callWaiter: 'Zawołaj kelnera', askBill: 'Poproś o rachunek', waiterCalled: 'Kelner już idzie', billRequested: 'Rachunek jest w drodze',
  callFailed: 'Nie udało się powiadomić obsługi. Spróbuj ponownie.',
  fromPrice: "Od {price}", contactTitle: "Pytania? Skontaktuj się z restauracją", callRestaurant: "Zadzwoń", whatsappAsk: "Dzień dobry! Chcę dowiedzieć się więcej o: {item}", todayHours: "Dziś: {text}", closedNextHours: "Zamknięte · {day}: {text}",
  welcomeVoiceBrowse: "Cześć! Jestem asystentem menu {name}. Dotknij mikrofonu i zapytaj o nasze dania.",
  chatWith: "Czat z {name}",
  greeting: "Cześć! Pomogę wybrać dania, wyjaśnię składniki i dodam pozycje do zamówienia.",
  greetingBrowse: "Cześć! Pomogę wybrać dania i wyjaśnię składniki.",
  suggestRecommend: "Co polecasz?",
  suggestPopular: "Co jest tu popularne?",
  suggestOrder: "Pomóż mi zamówić",
  suggestSpecials: "Opowiedz o specjałach",
  addedLabel: "Dodano",
  cartUpdatedLabel: "Zaktualizowano",
  cartRemovedLabel: "Usunięto",
  staffNotified: "Daliśmy znać zespołowi",
  expandChat: "Powiększ czat",
  shrinkChat: "Zmniejsz czat",
  signInPrompt: "Zaloguj się telefonem, aby czatować. Wyślemy Ci kod SMS-em.",
  signInButton: "Zaloguj się telefonem",
  conversationExpired: "Rozmowa zamknięta z powodu braku aktywności.",
  conversationLimit: "Ta rozmowa osiągnęła limit wiadomości.",
  newConversation: "Nowa rozmowa",
}

const tr: GuestCopy = {
  openChat: 'Yapay zekâ sohbetini aç', close: 'Kapat', askName: '{name} asistanına sor', aiAssistant: 'Menü asistanı',
  gateTitle: 'Asistanımızla sohbet edin', gateBody: 'Başlamak için telefon numaranızı girin. Yalnızca sohbeti size bağlamak için kullanıyoruz.',
  startChat: 'Sohbeti başlat', starting: 'Başlatılıyor…', couldNotStart: 'Sohbet başlatılamadı',
  welcomeText: 'Merhaba! {name} menü asistanıyım. Yemeklerimizle ilgili her şeyi sorabilirsiniz — eşleşmeler, malzemeler, öneriler — ya da canınızın ne çektiğini söyleyin.',
  welcomeVoice: 'Merhaba! {name} menü asistanıyım. Mikrofona dokunun ve ne istediğinizi söyleyin — bir soru ya da doğrudan siparişiniz.',
  somethingWrong: 'Bir şeyler ters gitti', micUnsupported: 'Bu tarayıcı mikrofonu desteklemiyor', micDenied: 'Mikrofon izni reddedildi',
  transcriptionFailed: 'Metne dökme başarısız', heardNothing: 'Kayıtta bir şey duyulmadı. Mikrofona biraz daha yakın deneyin.',
  viewCart: 'Sepeti gör', remainingToday: 'Bugün {n} mesaj hakkınız kaldı', discardRecording: 'Kaydı sil', stopAndSend: 'Durdur ve sesli mesajı gönder',
  transcribing: 'Sesli mesaj metne dökülüyor…', sending: 'Gönderiliyor…', tapToRecord: 'Kaydetmek için dokunun · en fazla {s} sn',
  typeOrRecord: 'Siparişinizi yazın veya kaydedin…', askMenu: 'Menü hakkında sorun…', recordVoice: 'Sesli mesaj kaydet (en fazla {s} saniye)', send: 'Gönder',
  callWaiter: 'Garson çağır', askBill: 'Hesabı iste', waiterCalled: 'Garson geliyor', billRequested: 'Hesap geliyor',
  callFailed: 'Personele ulaşılamadı. Lütfen tekrar deneyin.',
  fromPrice: "{price} itibarıyla", contactTitle: "Sorunuz mu var? Restoranla iletişime geçin", callRestaurant: "Ara", whatsappAsk: "Merhaba! {item} hakkında bilgi almak istiyorum", todayHours: "Bugün: {text}", closedNextHours: "Kapalı · {day}: {text}",
  welcomeVoiceBrowse: "Merhaba! {name} menü asistanıyım. Mikrofona dokunun ve yemeklerimiz hakkında istediğinizi sorun.",
  chatWith: "{name} ile sohbet et",
  greeting: "Merhaba! Yemek seçmene, malzemeleri açıklamana ve siparişine ürün eklemene yardımcı olabilirim.",
  greetingBrowse: "Merhaba! Yemek seçmene ve malzemeleri açıklamana yardımcı olabilirim.",
  suggestRecommend: "Ne önerirsin?",
  suggestPopular: "Burada en popüler ne?",
  suggestOrder: "Sipariş vermeme yardım et",
  suggestSpecials: "Özel lezzetlerden bahset",
  addedLabel: "Eklendi",
  cartUpdatedLabel: "Güncellendi",
  cartRemovedLabel: "Kaldırıldı",
  staffNotified: "Ekibe haber verdik",
  expandChat: "Sohbeti büyüt",
  shrinkChat: "Sohbeti küçült",
  signInPrompt: "Sohbet etmek için telefonunla giriş yap. Sana SMS ile bir kod göndeririz.",
  signInButton: "Telefonla giriş yap",
  conversationExpired: "Sohbet hareketsizlik nedeniyle kapatıldı.",
  conversationLimit: "Bu sohbet mesaj sınırına ulaştı.",
  newConversation: "Yeni sohbet",
}

const ru: GuestCopy = {
  openChat: 'Открыть ИИ-чат', close: 'Закрыть', askName: 'Спросите {name}', aiAssistant: 'ИИ-помощник по меню',
  gateTitle: 'Поговорите с нашим помощником', gateBody: 'Укажите номер телефона, чтобы начать. Он нужен только для привязки разговора к вам.',
  startChat: 'Начать', starting: 'Запуск…', couldNotStart: 'Не удалось начать чат',
  welcomeText: 'Здравствуйте! Я помощник по меню {name}. Спросите что угодно о блюдах — сочетания, ингредиенты, рекомендации — или расскажите, чего вам хочется.',
  welcomeVoice: 'Здравствуйте! Я помощник по меню {name}. Нажмите на микрофон и скажите, что хотите — задайте вопрос или сразу продиктуйте заказ.',
  somethingWrong: 'Что-то пошло не так', micUnsupported: 'Этот браузер не поддерживает микрофон', micDenied: 'Доступ к микрофону запрещён',
  transcriptionFailed: 'Не удалось расшифровать', heardNothing: 'В записи ничего не слышно. Попробуйте ближе к микрофону.',
  viewCart: 'Открыть корзину', remainingToday: 'Осталось сообщений сегодня: {n}', discardRecording: 'Удалить запись', stopAndSend: 'Остановить и отправить голосовое',
  transcribing: 'Расшифровка голосового…', sending: 'Отправка…', tapToRecord: 'Нажмите для записи · до {s} с',
  typeOrRecord: 'Напишите или продиктуйте заказ…', askMenu: 'Спросите о меню…', recordVoice: 'Записать голосовое (до {s} секунд)', send: 'Отправить',
  callWaiter: 'Позвать официанта', askBill: 'Попросить счёт', waiterCalled: 'Официант уже идёт', billRequested: 'Счёт скоро принесут',
  callFailed: 'Не удалось связаться с персоналом. Попробуйте ещё раз.',
  fromPrice: "От {price}", contactTitle: "Есть вопросы? Свяжитесь с рестораном", callRestaurant: "Позвонить", whatsappAsk: "Здравствуйте! Хочу узнать подробнее: {item}", todayHours: "Сегодня: {text}", closedNextHours: "Закрыто · {day}: {text}",
  welcomeVoiceBrowse: "Здравствуйте! Я помощник по меню {name}. Нажмите на микрофон и спросите что угодно о наших блюдах.",
  chatWith: "Чат с {name}",
  greeting: "Привет! Помогу выбрать блюда, расскажу о составе и добавлю позиции в заказ.",
  greetingBrowse: "Привет! Помогу выбрать блюда и расскажу о составе.",
  suggestRecommend: "Что посоветуете?",
  suggestPopular: "Что здесь популярно?",
  suggestOrder: "Помогите сделать заказ",
  suggestSpecials: "Расскажите о фирменных блюдах",
  addedLabel: "Добавлено",
  cartUpdatedLabel: "Обновлено",
  cartRemovedLabel: "Удалено",
  staffNotified: "Мы сообщили команде",
  expandChat: "Развернуть чат",
  shrinkChat: "Свернуть чат",
  signInPrompt: "Войдите по номеру телефона, чтобы общаться. Мы отправим код по SMS.",
  signInButton: "Войти по телефону",
  conversationExpired: "Диалог закрыт из-за неактивности.",
  conversationLimit: "В этом диалоге достигнут лимит сообщений.",
  newConversation: "Новый диалог",
}

const hi: GuestCopy = {
  openChat: 'AI चैट खोलें', close: 'बंद करें', askName: '{name} से पूछें', aiAssistant: 'AI मेन्यू सहायक',
  gateTitle: 'हमारे सहायक से बात करें', gateBody: 'शुरू करने के लिए अपना फ़ोन नंबर दें। हम इसे सिर्फ़ बातचीत आपसे जोड़ने के लिए इस्तेमाल करते हैं।',
  startChat: 'चैट शुरू करें', starting: 'शुरू हो रहा है…', couldNotStart: 'चैट शुरू नहीं हो सकी',
  welcomeText: 'नमस्ते! मैं {name} का मेन्यू सहायक हूँ। हमारे व्यंजनों के बारे में कुछ भी पूछें — जोड़ियाँ, सामग्री, सुझाव — या बताइए आपका क्या खाने का मन है।',
  welcomeVoice: 'नमस्ते! मैं {name} का मेन्यू सहायक हूँ। माइक्रोफ़ोन दबाएँ और बताइए आप क्या चाहते हैं — कोई सवाल या सीधे अपना ऑर्डर।',
  somethingWrong: 'कुछ गलत हो गया', micUnsupported: 'यह ब्राउज़र माइक्रोफ़ोन सपोर्ट नहीं करता', micDenied: 'माइक्रोफ़ोन की अनुमति नहीं मिली',
  transcriptionFailed: 'ट्रांसक्रिप्शन नहीं हो सका', heardNothing: 'रिकॉर्डिंग में कुछ सुनाई नहीं दिया। माइक्रोफ़ोन के थोड़ा पास से फिर कोशिश करें।',
  viewCart: 'कार्ट देखें', remainingToday: 'आज {n} संदेश बचे हैं', discardRecording: 'रिकॉर्डिंग हटाएँ', stopAndSend: 'रोकें और वॉइस संदेश भेजें',
  transcribing: 'आपका वॉइस नोट लिखा जा रहा है…', sending: 'भेजा जा रहा है…', tapToRecord: 'रिकॉर्ड करने के लिए दबाएँ · {s} सेकंड तक',
  typeOrRecord: 'अपना ऑर्डर लिखें या बोलें…', askMenu: 'मेन्यू के बारे में पूछें…', recordVoice: 'वॉइस संदेश रिकॉर्ड करें ({s} सेकंड तक)', send: 'भेजें',
  callWaiter: 'वेटर को बुलाएँ', askBill: 'बिल माँगें', waiterCalled: 'वेटर आ रहा है', billRequested: 'बिल आ रहा है',
  callFailed: 'स्टाफ़ तक संदेश नहीं पहुँचा। फिर से कोशिश करें।',
  fromPrice: "{price} से शुरू", contactTitle: "कोई सवाल? रेस्टोरेंट से संपर्क करें", callRestaurant: "कॉल करें", whatsappAsk: "नमस्ते! मैं {item} के बारे में और जानना चाहता हूँ", todayHours: "आज: {text}", closedNextHours: "बंद · {day}: {text}",
  welcomeVoiceBrowse: "नमस्ते! मैं {name} का मेन्यू सहायक हूँ। माइक्रोफ़ोन टैप करें और हमारे व्यंजनों के बारे में कुछ भी पूछें।",
  chatWith: "{name} से चैट करें",
  greeting: "नमस्ते! मैं व्यंजन चुनने, सामग्री समझाने और आपके ऑर्डर में आइटम जोड़ने में मदद कर सकता हूँ।",
  greetingBrowse: "नमस्ते! मैं व्यंजन चुनने और सामग्री समझाने में मदद कर सकता हूँ।",
  suggestRecommend: "आप क्या सुझाएंगे?",
  suggestPopular: "यहाँ क्या लोकप्रिय है?",
  suggestOrder: "ऑर्डर करने में मदद करें",
  suggestSpecials: "स्पेशल के बारे में बताइए",
  addedLabel: "जोड़ा गया",
  cartUpdatedLabel: "अपडेट किया गया",
  cartRemovedLabel: "हटाया गया",
  staffNotified: "हमने टीम को सूचित कर दिया है",
  expandChat: "चैट बड़ा करें",
  shrinkChat: "चैट छोटा करें",
  signInPrompt: "चैट करने के लिए अपने फ़ोन से साइन इन करें। हम आपको SMS से कोड भेजते हैं।",
  signInButton: "फ़ोन से साइन इन करें",
  conversationExpired: "निष्क्रियता के कारण बातचीत बंद हो गई।",
  conversationLimit: "इस बातचीत में संदेशों की सीमा पूरी हो गई।",
  newConversation: "नई बातचीत",
}

const ja: GuestCopy = {
  openChat: 'AIチャットを開く', close: '閉じる', askName: '{name}に質問', aiAssistant: 'AIメニューアシスタント',
  gateTitle: 'AIアシスタントとチャット', gateBody: '電話番号を入力して開始してください。会話をあなたに紐づけるためだけに使います。',
  startChat: 'チャットを始める', starting: '開始中…', couldNotStart: 'チャットを開始できませんでした',
  welcomeText: 'こんにちは！{name}のメニューアシスタントです。料理の組み合わせ、食材、おすすめなど何でも聞いてください。食べたい気分を教えていただければご提案します。',
  welcomeVoice: 'こんにちは！{name}のメニューアシスタントです。マイクをタップして、ご質問やご注文をお話しください。',
  somethingWrong: 'エラーが発生しました', micUnsupported: 'このブラウザはマイクに対応していません', micDenied: 'マイクの使用が許可されていません',
  transcriptionFailed: '文字起こしに失敗しました', heardNothing: '録音から音声が聞き取れませんでした。マイクに近づいてもう一度お試しください。',
  viewCart: 'カートを見る', remainingToday: '本日の残りメッセージ：{n}件', discardRecording: '録音を破棄', stopAndSend: '停止してボイスメッセージを送信',
  transcribing: 'ボイスメッセージを文字起こし中…', sending: '送信中…', tapToRecord: 'タップして録音 · 最大{s}秒',
  typeOrRecord: 'ご注文を入力または録音…', askMenu: 'メニューについて質問…', recordVoice: 'ボイスメッセージを録音（最大{s}秒）', send: '送信',
  callWaiter: 'スタッフを呼ぶ', askBill: 'お会計をお願いする', waiterCalled: 'スタッフが向かっています', billRequested: 'お会計をお持ちします',
  callFailed: 'スタッフに通知できませんでした。もう一度お試しください。',
  fromPrice: "{price}〜", contactTitle: "ご質問はお店へどうぞ", callRestaurant: "電話", whatsappAsk: "こんにちは！{item}について詳しく知りたいです", todayHours: "本日：{text}", closedNextHours: "営業時間外 · {day}：{text}",
  welcomeVoiceBrowse: "こんにちは！{name}のメニューアシスタントです。マイクをタップして、料理について何でも聞いてください。",
  chatWith: "{name}とチャット",
  greeting: "こんにちは！料理選びや食材の説明、ご注文への追加をお手伝いします。",
  greetingBrowse: "こんにちは！料理選びや食材の説明をお手伝いします。",
  suggestRecommend: "おすすめは何ですか？",
  suggestPopular: "人気のメニューは？",
  suggestOrder: "注文を手伝って",
  suggestSpecials: "日替わりやおすすめを教えて",
  addedLabel: "追加済み",
  cartUpdatedLabel: "更新しました",
  cartRemovedLabel: "削除しました",
  staffNotified: "スタッフに連絡しました",
  expandChat: "チャットを広げる",
  shrinkChat: "チャットを縮める",
  signInPrompt: "チャットするには電話番号でサインインしてください。SMSでコードを送信します。",
  signInButton: "電話番号でサインイン",
  conversationExpired: "しばらく操作がなかったため、会話を終了しました。",
  conversationLimit: "この会話はメッセージの上限に達しました。",
  newConversation: "新しい会話",
}

const ko: GuestCopy = {
  openChat: 'AI 채팅 열기', close: '닫기', askName: '{name}에 물어보기', aiAssistant: 'AI 메뉴 도우미',
  gateTitle: 'AI 도우미와 채팅하기', gateBody: '시작하려면 전화번호를 입력하세요. 대화를 고객님과 연결하는 데만 사용합니다.',
  startChat: '채팅 시작', starting: '시작하는 중…', couldNotStart: '채팅을 시작할 수 없습니다',
  welcomeText: '안녕하세요! {name}의 메뉴 도우미입니다. 음식 조합, 재료, 추천 등 무엇이든 물어보세요. 드시고 싶은 걸 말씀하시면 추천해 드릴게요.',
  welcomeVoice: '안녕하세요! {name}의 메뉴 도우미입니다. 마이크를 눌러 원하시는 것을 말씀하세요. 질문이나 바로 주문도 좋아요.',
  somethingWrong: '문제가 발생했습니다', micUnsupported: '이 브라우저는 마이크를 지원하지 않습니다', micDenied: '마이크 권한이 거부되었습니다',
  transcriptionFailed: '음성 변환에 실패했습니다', heardNothing: '녹음에서 아무것도 들리지 않았어요. 마이크에 조금 더 가까이에서 다시 시도해 주세요.',
  viewCart: '장바구니 보기', remainingToday: '오늘 남은 메시지 {n}개', discardRecording: '녹음 삭제', stopAndSend: '중지하고 음성 메시지 보내기',
  transcribing: '음성 메시지를 변환하는 중…', sending: '보내는 중…', tapToRecord: '눌러서 녹음 · 최대 {s}초',
  typeOrRecord: '주문을 입력하거나 녹음하세요…', askMenu: '메뉴에 대해 물어보세요…', recordVoice: '음성 메시지 녹음 (최대 {s}초)', send: '보내기',
  callWaiter: '직원 호출', askBill: '계산서 요청', waiterCalled: '직원이 가고 있어요', billRequested: '계산서를 가져다 드릴게요',
  callFailed: '직원에게 알리지 못했어요. 다시 시도해 주세요.',
  fromPrice: "{price}부터", contactTitle: "궁금한 점은 매장에 문의하세요", callRestaurant: "전화", whatsappAsk: "안녕하세요! {item}에 대해 더 알고 싶어요", todayHours: "오늘: {text}", closedNextHours: "영업 종료 · {day}: {text}",
  welcomeVoiceBrowse: "안녕하세요! {name} 메뉴 도우미입니다. 마이크를 누르고 메뉴에 대해 무엇이든 물어보세요.",
  chatWith: "{name} 채팅",
  greeting: "안녕하세요! 메뉴 선택, 재료 설명, 주문에 항목 추가를 도와드릴게요.",
  greetingBrowse: "안녕하세요! 메뉴 선택과 재료 설명을 도와드릴게요.",
  suggestRecommend: "추천해 주세요",
  suggestPopular: "여기서 인기 있는 건 뭐예요?",
  suggestOrder: "주문을 도와주세요",
  suggestSpecials: "스페셜 메뉴를 알려주세요",
  addedLabel: "추가됨",
  cartUpdatedLabel: "업데이트됨",
  cartRemovedLabel: "삭제됨",
  staffNotified: "직원에게 알렸어요",
  expandChat: "채팅 확대",
  shrinkChat: "채팅 축소",
  signInPrompt: "채팅하려면 휴대폰으로 로그인하세요. SMS로 코드를 보내 드립니다.",
  signInButton: "휴대폰으로 로그인",
  conversationExpired: "일정 시간 활동이 없어 대화가 종료되었습니다.",
  conversationLimit: "이 대화는 메시지 한도에 도달했습니다.",
  newConversation: "새 대화",
}

const zh: GuestCopy = {
  openChat: '打开 AI 聊天', close: '关闭', askName: '咨询{name}', aiAssistant: 'AI 菜单助手',
  gateTitle: '与我们的 AI 助手聊天', gateBody: '请输入手机号开始。我们只用它把对话与您关联。',
  startChat: '开始聊天', starting: '正在开始…', couldNotStart: '无法开始聊天',
  welcomeText: '您好！我是{name}的菜单助手。关于菜品的搭配、食材、推荐都可以问我，或者告诉我您想吃什么，我来推荐。',
  welcomeVoice: '您好！我是{name}的菜单助手。点按麦克风说出您的需求——可以提问，也可以直接点餐。',
  somethingWrong: '出了点问题', micUnsupported: '此浏览器不支持麦克风', micDenied: '麦克风权限被拒绝',
  transcriptionFailed: '语音转文字失败', heardNothing: '录音里没有听到声音，请靠近麦克风再试一次。',
  viewCart: '查看购物车', remainingToday: '今天还剩 {n} 条消息', discardRecording: '删除录音', stopAndSend: '停止并发送语音消息',
  transcribing: '正在转写您的语音…', sending: '正在发送…', tapToRecord: '点按录音 · 最长 {s} 秒',
  typeOrRecord: '输入或录制您的订单…', askMenu: '咨询菜单…', recordVoice: '录制语音消息（最长 {s} 秒）', send: '发送',
  callWaiter: '呼叫服务员', askBill: '结账', waiterCalled: '服务员马上就到', billRequested: '账单马上送到',
  callFailed: '未能通知工作人员，请重试。',
  fromPrice: "{price}起", contactTitle: "有疑问？联系餐厅", callRestaurant: "致电", whatsappAsk: "你好！我想了解一下{item}", todayHours: "今天：{text}", closedNextHours: "已打烊 · {day}：{text}",
  welcomeVoiceBrowse: "你好！我是{name}的菜单助手。点按麦克风，关于菜品的任何问题都可以问我。",
  chatWith: "与{name}聊天",
  greeting: "你好！我可以帮你挑选菜品、讲解食材，并把菜品加入订单。",
  greetingBrowse: "你好！我可以帮你挑选菜品、讲解食材。",
  suggestRecommend: "你有什么推荐？",
  suggestPopular: "这里什么最受欢迎？",
  suggestOrder: "帮我点餐",
  suggestSpecials: "介绍一下特色菜",
  addedLabel: "已添加",
  cartUpdatedLabel: "已更新",
  cartRemovedLabel: "已移除",
  staffNotified: "已通知店员",
  expandChat: "展开聊天",
  shrinkChat: "收起聊天",
  signInPrompt: "请使用手机号登录后聊天，我们会通过短信发送验证码。",
  signInButton: "使用手机号登录",
  conversationExpired: "因长时间无操作，对话已结束。",
  conversationLimit: "本次对话已达到消息上限。",
  newConversation: "新对话",
}

const zhTW: GuestCopy = {
  openChat: '開啟 AI 聊天', close: '關閉', askName: '詢問{name}', aiAssistant: 'AI 菜單助理',
  gateTitle: '與我們的 AI 助理聊天', gateBody: '請輸入手機號碼開始。我們只用它將對話與您連結。',
  startChat: '開始聊天', starting: '正在開始…', couldNotStart: '無法開始聊天',
  welcomeText: '您好！我是{name}的菜單助理。關於菜色的搭配、食材、推薦都可以問我，或告訴我您想吃什麼，我來推薦。',
  welcomeVoice: '您好！我是{name}的菜單助理。點按麥克風說出您的需求——可以提問，也可以直接點餐。',
  somethingWrong: '發生錯誤', micUnsupported: '此瀏覽器不支援麥克風', micDenied: '麥克風權限遭拒',
  transcriptionFailed: '語音轉文字失敗', heardNothing: '錄音中沒有聽到聲音，請靠近麥克風再試一次。',
  viewCart: '查看購物車', remainingToday: '今天還剩 {n} 則訊息', discardRecording: '刪除錄音', stopAndSend: '停止並傳送語音訊息',
  transcribing: '正在轉寫您的語音…', sending: '傳送中…', tapToRecord: '點按錄音 · 最長 {s} 秒',
  typeOrRecord: '輸入或錄製您的訂單…', askMenu: '詢問菜單…', recordVoice: '錄製語音訊息（最長 {s} 秒）', send: '傳送',
  callWaiter: '呼叫服務生', askBill: '結帳', waiterCalled: '服務生馬上就到', billRequested: '帳單馬上送到',
  callFailed: '未能通知工作人員，請再試一次。',
  fromPrice: "{price}起", contactTitle: "有疑問？聯絡餐廳", callRestaurant: "撥打電話", whatsappAsk: "您好！我想了解一下{item}", todayHours: "今天：{text}", closedNextHours: "已打烊 · {day}：{text}",
  welcomeVoiceBrowse: "您好！我是{name}的菜單助理。點按麥克風，關於菜色的任何問題都可以問我。",
  chatWith: "與{name}聊天",
  greeting: "你好！我可以幫你挑選餐點、說明食材，並把餐點加入訂單。",
  greetingBrowse: "你好！我可以幫你挑選餐點、說明食材。",
  suggestRecommend: "你有什麼推薦？",
  suggestPopular: "這裡什麼最受歡迎？",
  suggestOrder: "幫我點餐",
  suggestSpecials: "介紹一下特色餐點",
  addedLabel: "已加入",
  cartUpdatedLabel: "已更新",
  cartRemovedLabel: "已移除",
  staffNotified: "已通知店員",
  expandChat: "展開聊天",
  shrinkChat: "收合聊天",
  signInPrompt: "請使用手機號碼登入後聊天，我們會透過簡訊傳送驗證碼。",
  signInButton: "使用手機號碼登入",
  conversationExpired: "因長時間未操作，對話已結束。",
  conversationLimit: "本次對話已達訊息上限。",
  newConversation: "新對話",
}

const COPY: Record<string, GuestCopy> = { en, pt, es, fr, de, it, nl, pl, tr, ru, hi, ja, ko, zh, 'zh-TW': zhTW }

export function getGuestCopy(lang: string | null | undefined): GuestCopy {
  if (!lang) return en
  return COPY[lang] ?? COPY[lang.split('-')[0]] ?? en
}

/** Every language has every key (checked by tests/unit/menu/guest-copy.test.ts). */
export const GUEST_COPY_LANGUAGES = Object.keys(COPY)
