from .models import NpDelStavbe, KppDelStavbe, KppDelStavbeDeduplicated, NpDelStavbeDeduplicated


def calculate_cluster_resolution(zoom_level: float) -> float:
    """
    Izračun prostorske ločljivosti za združevanje v clusters na podlagi stopnje povečave.
    Večja povečava = manjši clusters
    Manjša povečava = večji clusters
    """
    # zoom 12, cluster radius ≈ 0.001 degrees (≈77m in Slovenia)
    # zoom 6, cluster radius ≈ 0.1 degrees (≈7.7km in Slovenia)
    base_resolution = 0.01  # Resolution at zoom 12
    zoom_factor = 2 ** (12 - zoom_level)
    return base_resolution * zoom_factor


def get_property_model(data_source: str):
    """
    vrne model odvisno od tega če pošiljaš kpp ali np podatke na frontend
    """
    if data_source.lower() == "kpp":
        return KppDelStavbe
    else:
        return NpDelStavbe
    

def get_deduplicated_property_model(data_source: str):
    """
    vrne deduplicirani model odvisno od tega če pošiljaš kpp ali np podatke na frontend
    """
    if data_source.lower() == "kpp":
        return KppDelStavbeDeduplicated
    else:
        return NpDelStavbeDeduplicated