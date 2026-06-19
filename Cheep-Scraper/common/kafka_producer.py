"""
Kafka producer — ham scrape ürünlerini `raw.products.v1` topic'ine Avro ile üretir.
Backend pipeline'ı (normalizer -> matcher -> persister) bunları tüketir.

Env:
  KAFKA_BROKERS        (default: localhost:9092)
  SCHEMA_REGISTRY_URL  (default: http://localhost:8081)

Bağımlılıklar: confluent-kafka[avro] (requirements.txt'te).
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

RAW_PRODUCTS_TOPIC = "raw.products.v1"

# Backend src/kafka/avro/raw-product.schema.ts ile birebir aynı olmalı.
RAW_PRODUCT_AVRO_SCHEMA = """
{
  "type": "record",
  "name": "RawProduct",
  "namespace": "cheep.ingest",
  "fields": [
    {"name": "eventId", "type": "string"},
    {"name": "countryCode", "type": "string"},
    {"name": "storeId", "type": "int"},
    {"name": "storeSku", "type": "string"},
    {"name": "name", "type": "string"},
    {"name": "brand", "type": ["null", "string"], "default": null},
    {"name": "price", "type": "string"},
    {"name": "unit", "type": ["null", "string"], "default": null},
    {"name": "rawCategory", "type": ["null", "string"], "default": null},
    {"name": "imageUrl", "type": ["null", "string"], "default": null},
    {"name": "scrapedAt", "type": "string"}
  ]
}
"""


def _payload_to_event(payload: Dict, country_code: str) -> Dict:
    """Backend API payload formatını RawProduct Avro event'ine çevirir."""
    return {
        "eventId": str(uuid.uuid4()),
        "countryCode": country_code,
        "storeId": int(payload.get("store_id")),
        "storeSku": str(payload.get("store_sku", "")),
        "name": str(payload.get("name", "")),
        "brand": payload.get("brand"),
        "price": str(payload.get("price", "0")),
        "unit": payload.get("unit"),
        "rawCategory": payload.get("raw_category"),
        "imageUrl": payload.get("image_url"),
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
    }


class RawProductProducer:
    """raw.products.v1'e Avro üreten ince sarmalayıcı (key = countryCode)."""

    def __init__(self, brokers: Optional[str] = None, schema_registry_url: Optional[str] = None):
        # Importlar burada: kütüphane yoksa sadece Kafka modu çağrıldığında patlar.
        from confluent_kafka import SerializingProducer
        from confluent_kafka.schema_registry import SchemaRegistryClient
        from confluent_kafka.schema_registry.avro import AvroSerializer
        from confluent_kafka.serialization import StringSerializer

        brokers = brokers or os.getenv("KAFKA_BROKERS", "localhost:9092")
        sr_url = schema_registry_url or os.getenv("SCHEMA_REGISTRY_URL", "http://localhost:8081")

        sr_client = SchemaRegistryClient({"url": sr_url})
        avro_serializer = AvroSerializer(
            sr_client,
            RAW_PRODUCT_AVRO_SCHEMA,
            lambda obj, ctx: obj,  # event zaten dict
        )

        self._producer = SerializingProducer(
            {
                "bootstrap.servers": brokers,
                "key.serializer": StringSerializer("utf_8"),
                "value.serializer": avro_serializer,
                "enable.idempotence": True,
            }
        )
        self._topic = RAW_PRODUCTS_TOPIC

    def produce_payloads(self, payloads: List[Dict], country_code: str) -> int:
        """API payload listesini raw event olarak üretir. ONAYLANMIŞ teslim sayısını
        döner (broker tarafından kabul edilen). Teslim hataları on_delivery
        callback'iyle yüzeye çıkarılır ve sayıma DAHİL EDİLMEZ."""
        delivered = 0
        failed = 0

        def _on_delivery(err, msg):
            nonlocal delivered, failed
            if err is not None:
                failed += 1
                logger.error("❌ Kafka teslim hatası: %s", err)
            else:
                delivered += 1

        produced = 0
        for payload in payloads:
            event = _payload_to_event(payload, country_code)
            self._producer.produce(
                topic=self._topic, key=country_code, value=event,
                on_delivery=_on_delivery,
            )
            produced += 1
            # Periyodik poll ile delivery callback'lerini tetikle / bellek kontrolü
            if produced % 500 == 0:
                self._producer.poll(0)
        self._producer.flush()
        if failed:
            logger.warning("⚠️ %d/%d ürün teslim EDİLEMEDİ (country=%s)",
                           failed, produced, country_code)
        logger.info("✅ %d/%d ham ürün '%s' topic'ine teslim edildi (country=%s)",
                    delivered, produced, self._topic, country_code)
        return delivered
