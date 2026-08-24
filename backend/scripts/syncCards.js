const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { getCachedCards } = require('../services/cardService');
const Card = require('../models/Card');
const logger = require('../config/logger');
const connectDB = require('../config/db');

// Importa dal foglio sorgente le carte che non sono ancora nel database.
// Fino al 2026-08-24 questo script calcolava anche un vettore per ogni carta
// tramite un fornitore esterno: la ricerca semantica che li usava e' stata
// rimossa, quindi non vengono piu' generati. Il campo resta nello schema con i
// valori storici, che nessuno legge.
const syncCards = async () => {
    try {
        await connectDB();
        logger.info('SISTEMA_VIGILE: Inizio sincronizzazione delle carte...');

        const sheetCards = await getCachedCards();
        let updatedCount = 0;

        for (const sCard of sheetCards) {
            let dbCard = await Card.findOne({ cardId: sCard.id });

            if (!dbCard) {
                logger.info(`NUOVA_CARTA: Inserimento di "${sCard.name}"...`);

                await Card.create({
                    cardId: sCard.id,
                    name: sCard.name,
                    type: sCard.type,
                    status: sCard.status,
                    cost_et: sCard.cost_et,
                    pep: sCard.pep,
                    rp: sCard.rp,
                    rarity: sCard.rarity,
                    effect: sCard.effect,
                    role: sCard.role,
                    image_url: sCard.image_url
                });
                updatedCount++;
            }
        }

        logger.info(`SINCRONIZZAZIONE_COMPLETATA: ${updatedCount} carte aggiornate con successo.`);
        process.exit(0);
    } catch (error) {
        logger.error(`ERRORE_SYNC_CARTE: ${error.message}`);
        process.exit(1);
    }
};

syncCards();
