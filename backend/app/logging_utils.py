import logging
import sys
from typing import Optional


class PrefixFilter(logging.Filter):
    
    def __init__(self, name=''):
        super().__init__(name)
        self.prefix = "UNKNOWN"
        
    def filter(self, record):
        record.prefix = self.prefix
        return True


class YearTypeFilter(logging.Filter):
    
    def __init__(self, name=''):
        super().__init__(name)
        self.current_year = "N/A"
        self.current_type = "N/A"
        
    def filter(self, record):
        if record.getMessage().startswith("="):
            record.is_separator = True
        else:
            record.ingestion_year = self.current_year
            record.ingestion_type = self.current_type
            record.is_separator = False
        return True


class ConditionalFormatter(logging.Formatter):
    
    def format(self, record):
        if hasattr(record, 'is_separator') and record.is_separator:
            return record.getMessage()
        else:
            return super().format(record)


def setup_logger(name: str, log_file: str, prefix: str, 
                year_filter: Optional[YearTypeFilter] = None) -> logging.Logger:
    """
    Setup a logger with file and console output.
    
    Args:
        name: Logger name
        log_file: Log file path
        prefix: Prefix for log messages (e.g., 'EI', 'DEDUP', 'INGEST')
        year_filter: Optional year/type filter for data ingestion logging
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    if logger.handlers:
        return logger
        
    logger.setLevel(logging.INFO)
    
    prefix_filter = PrefixFilter()
    prefix_filter.prefix = prefix
    
    if year_filter:
        formatter = ConditionalFormatter(
            '%(asctime)s - %(levelname)s - [leto:%(ingestion_year)s] [%(ingestion_type)s] - %(message)s'
        )
    else:
        formatter = logging.Formatter(f'%(asctime)s - %(levelname)s - [%(prefix)s] - %(message)s')
    
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    stream_handler = logging.StreamHandler(sys.stdout)
    
    for handler in [file_handler, stream_handler]:
        handler.setLevel(logging.INFO)
        handler.setFormatter(formatter)
        handler.addFilter(prefix_filter)
        
        if year_filter:
            handler.addFilter(year_filter)
            
        logger.addHandler(handler)
    
    logger.propagate = False
    return logger


def get_logger_for_context(context_name: str) -> logging.Logger:
    """
    Get the appropriate logger based on context.
    This helps sql_utils determine which logger to use.
    
    Args:
        context_name: Name of the calling context ('deduplication', 'ei_ingestion', 'data_ingestion')
        
    Returns:
        Logger instance for the context
    """
    return logging.getLogger(context_name)