use crate::{
    backend::{
        message::{CardMessage, TunnelOneshot},
        worker::{send_worker_response, Worker},
    },
    store::{
        db::Database,
        models::{random_uuid, Card, InternalResourceTagNames, ResourceTag},
    },
    BackendError, BackendResult,
};
use neon::prelude::Channel;

impl Worker {
    pub fn list_all_cards_in_horizon(&mut self, horizon_id: &str) -> BackendResult<Vec<Card>> {
        Ok(self.db.list_all_cards(horizon_id)?)
    }

    // pub fn list_cards(
    //     &mut self,
    //     horizon_id: &str,
    //     limit: i64,
    //     offset: i64,
    // ) -> BackendResult<PaginatedCards> {
    //     Ok(self.db.list_cards(horizon_id, limit, offset)?)
    // }

    pub fn create_card(&mut self, mut card: Card) -> BackendResult<Card> {
        let mut tx = self.db.begin()?;
        Database::create_card_tx(&mut tx, &mut card)?;

        if card.resource_id != "" {
            let horizon_id_tag = ResourceTag {
                id: random_uuid(),
                resource_id: card.resource_id.clone(),
                tag_name: InternalResourceTagNames::HorizonId.to_string(),
                tag_value: card.horizon_id.clone(),
            };
            Database::create_resource_tag_tx(&mut tx, &horizon_id_tag)?;
        }

        tx.commit()?;
        Ok(card)
    }

    pub fn get_card(&mut self, card_id: &str) -> BackendResult<Option<Card>> {
        Ok(self.db.get_card(card_id)?)
    }

    pub fn update_card_data(&mut self, card_id: &str, data: Vec<u8>) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_card_data_tx(&mut tx, card_id, data)?;
        tx.commit()?;
        Ok(())
    }

    pub fn update_card_dimensions(
        &mut self,
        card_id: &str,
        position_x: i64,
        position_y: i64,
        width: i32,
        height: i32,
    ) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_card_dimensions_tx(
            &mut tx, card_id, position_x, position_y, width, height,
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn update_card_resource_id(
        &mut self,
        card_id: &str,
        resource_id: &str,
    ) -> BackendResult<()> {
        let card = match self.db.get_card(card_id)? {
            Some(card) => card,
            None => {
                return Err(BackendError::GenericError(
                    "No such card with given id found".to_string(),
                ))
            }
        };
        if card.resource_id == resource_id {
            return Ok(());
        }
        let mut tx = self.db.begin()?;

        if card.resource_id != "" {
            Database::remove_resource_tag_by_tag_name_tx(
                &mut tx,
                &card.resource_id,
                InternalResourceTagNames::HorizonId.as_str(),
            )?;
        }

        Database::update_card_resource_id_tx(&mut tx, card_id, resource_id)?;

        if resource_id != "" {
            Database::create_resource_tag_tx(
                &mut tx,
                &ResourceTag {
                    id: random_uuid(),
                    resource_id: resource_id.to_string(),
                    tag_name: InternalResourceTagNames::HorizonId.to_string(),
                    tag_value: card.horizon_id.clone(),
                },
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn update_card_stacking_order(&mut self, card_id: &str) -> BackendResult<()> {
        let mut tx = self.db.begin()?;
        Database::update_card_stacking_order_tx(&mut tx, card_id)?;
        tx.commit()?;
        Ok(())
    }

    pub fn remove_card(&mut self, card_id: &str) -> BackendResult<()> {
        let card = match self.db.get_card(card_id)? {
            Some(card) => card,
            None => {
                return Err(BackendError::GenericError(
                    "No such card with given id found".to_string(),
                ))
            }
        };
        let mut tx = self.db.begin()?;
        Database::remove_resource_tag_by_tag_name_tx(
            &mut tx,
            &card.resource_id,
            InternalResourceTagNames::HorizonId.as_str(),
        )?;
        Database::remove_card_tx(&mut tx, card_id)?;
        tx.commit()?;
        Ok(())
    }
}

pub fn handle_card_message(
    worker: &mut Worker,
    channel: &mut Channel,
    oneshot: TunnelOneshot,
    message: CardMessage,
) {
    match message {
        CardMessage::CreateCard(card) => {
            send_worker_response(channel, oneshot, worker.create_card(card))
        }
        CardMessage::GetCard(card_id) => {
            send_worker_response(channel, oneshot, worker.get_card(&card_id))
        }
        CardMessage::RemoveCard(card_id) => {
            send_worker_response(channel, oneshot, worker.remove_card(&card_id))
        }
        CardMessage::UpdateCardData(card_id, data) => {
            send_worker_response(channel, oneshot, worker.update_card_data(&card_id, data))
        }
        CardMessage::UpdateCardDimensions(card_id, position_x, position_y, width, height) => {
            send_worker_response(
                channel,
                oneshot,
                worker.update_card_dimensions(&card_id, position_x, position_y, width, height),
            )
        }
        CardMessage::UpdateCardResourceID(card_id, resource_id) => send_worker_response(
            channel,
            oneshot,
            worker.update_card_resource_id(&card_id, &resource_id),
        ),
        CardMessage::UpdateCardStackingOrder(card_id) => send_worker_response(
            channel,
            oneshot,
            worker.update_card_stacking_order(&card_id),
        ),
        CardMessage::ListCardsInHorizon(horizon_id) => send_worker_response(
            channel,
            oneshot,
            worker.list_all_cards_in_horizon(&horizon_id),
        ),
    }
}
