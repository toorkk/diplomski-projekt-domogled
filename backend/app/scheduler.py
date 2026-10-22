import asyncio
import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .routes import ingestion_service, deduplication_service, ei_ingestion_service, stats_service
from .email_notifications import send_error_email

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def weekly_update():
    logger.info("--------------------------------------------------------")
    logger.info("Začetek tedenskega posodabljanja podatkov...")
    logger.info("--------------------------------------------------------")

    # servisi napak ne vržejo, ampak vrnejo {"status": "error", ...}, zato jih zberemo in na koncu pošljemo en email
    errors = []
    try:
        current_year = datetime.now().year

        for year in [current_year - 1, current_year]:
            for data_type in ["kpp", "np"]:
                result = await ingestion_service.run_ingestion(str(year), data_type)
                if result.get("status") == "error":
                    errors.append(f"Vnos {data_type} za leto {year}: {result.get('message')}")

        result = await asyncio.to_thread(ei_ingestion_service.run_ingestion, url=None)
        if result.get("status") == "error":
            errors.append(f"Uvoz energetskih izkaznic: {result.get('message')}")

        await asyncio.to_thread(deduplication_service.create_all_deduplicated_del_stavbe, ["np", "kpp"])

        result = await asyncio.to_thread(stats_service.refresh_all_statistics)
        if result.get("status") == "error":
            errors.append(f"Posodabljanje statistik: {result.get('message')}")

        logger.info("Tedensko posodabljanje zaključeno.")
    except Exception as e:
        logger.error(f"Napaka pri tedenskem posodabljanju: {e}")
        errors.append(f"Nepričakovana napaka pri posodabljanju: {e}")

    if errors:
        body = (
            f"Pri posodabljanju podatkov ({datetime.now():%d.%m.%Y %H:%M}) je prišlo do {len(errors)} napak:\n\n"
            + "\n\n".join(f"{i}. {error}" for i, error in enumerate(errors, 1))
            + "\n\nPodrobnosti so v logih na Railway."
        )
        await asyncio.to_thread(send_error_email, f"DOMOGLED: NAPAKA PRI POSODABLJANJU ({len(errors)})", body)
