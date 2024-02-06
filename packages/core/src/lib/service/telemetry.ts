import type { Card } from '../types';
import { HorizonDatabase } from "./storage";
import * as amplitude from "@amplitude/analytics-browser";
import {de} from "date-fns/locale";

export const EventTypes = {
    CreateHorizon: 'Create Horizon',
    DeleteHorizon: 'Delete Horizon',
    ActivateHorizon: 'Activate Horizon',
    AddCard: 'Add Card',
    DeleteCard: 'Delete Card',
    DuplicateCard: 'Duplicate Card',
    UpdateCard: 'Update Card',
}

export class Telemetry {
    storage: HorizonDatabase
    apiKey: string
    constructor(apiKey: string, storage: HorizonDatabase) {
        this.storage = storage
        this.apiKey = apiKey
    }
    async init(){
        let userID = await this.storage.getUserID()
        if (!userID) {
            const userData = await this.storage.createUserData()
            userID = userData.user_id
        }
        amplitude.init(this.apiKey, userID, {
            defaultTracking: {
                attribution: false,
                pageViews: false,
                sessions: true,
                formInteractions: false,
                fileDownloads: false,
            }
        })
    }

    extractEventPropertiesFromCard(card: Partial<Card>, duplicated: boolean = false){
        let eventProperties = {
            id: card.id,
            type: card.type,
            positionX: card.x,
            positionY: card.y,
            width: card.width,
            height: card.height,
            // we don't want to store false values in amplitude
            duplicated: duplicated? true: undefined
        }
        switch (card.type) {
            case 'browser':
                let location = card.data.initialLocation
                if (card.data.currentHistoryIndex > 0){
                    location = card.data.historyStack[card.data.currentHistoryIndex]
                }
                eventProperties = {
                    ...eventProperties,
                    location: location,
                }
                break
            case 'link':
                eventProperties= {
                    ...eventProperties,
                    url: card.data.url
                }
                break
            case 'file':
                eventProperties = {
                    ...eventProperties,
                    mimeType: card.data.mimeType
                }
                break
        }
        return eventProperties
    }

    async trackEvent(eventName: string, eventProperties: Record<string, any> | undefined){
        if (!this.apiKey || !this.storage){
            return
        }
        // TODO: figure out why this is happening
        if (eventName == EventTypes.UpdateCard && !eventProperties.id) {
           return
        }
        await amplitude.track(eventName, eventProperties)
    }
    // this is a separate function as market needs cards metadata when tracking this event
    // TODO: figure out how much does this hurt performance?
    async trackActivateHorizonEvent(horizonID: string) {
        if (!this.storage){
            return
        }
        const storedCards = await this.storage.getCardsByHorizonId(horizonID) ?? []
        const cardProperties = storedCards.map(card => this.extractEventPropertiesFromCard(card))
        await this.trackEvent(EventTypes.ActivateHorizon, {cards: cardProperties})
    }
}