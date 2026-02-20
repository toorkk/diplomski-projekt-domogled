import asyncio
import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .routes import ingestion_service, deduplication_service, ei_ingestion_service, stats_service

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def weekly_update():
    logger.info("--------------------------------------------------------")
    logger.info("Začetek tedenskega posodabljanja podatkov...")
    logger.info("--------------------------------------------------------")
    try:
        current_year = datetime.now().year

        for year in [current_year - 1, current_year]:
            await ingestion_service.run_ingestion(str(year), "kpp")
            await ingestion_service.run_ingestion(str(year), "np")

        await asyncio.to_thread(ei_ingestion_service.run_ingestion, url=None)
        await asyncio.to_thread(deduplication_service.create_all_deduplicated_del_stavbe, ["np", "kpp"])
        await asyncio.to_thread(stats_service.refresh_all_statistics)

        logger.info("Tedensko posodabljanje zaključeno.")
    except Exception as e:
        logger.error(f"Napaka pri tedenskem posodabljanju: {e}")