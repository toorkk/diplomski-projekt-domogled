#######################################################
#
#   TE FUNKCIJE SE NE UPORABLJAJO VEČ AMPAK BODO MOGOČE KDAJ USEFUL V PRIHODNOSTI ČE NADALJUJEMA Z RAZVOJEM
#
#######################################################
    @staticmethod
    def get_municipality_all_del_stavb(sifko: int = None, municipality: str = None, db: Session = None, data_source: str = "np", filters: dict = None):
        """
        Pridobi VSE nepremičnine v določeni občini (ignoriraj bbox)
        Uporabi samo building clustering po stavbah
        """
        DeduplicatedModel = get_deduplicated_del_stavbe_model(data_source)
        
        base_query = db.query(
            func.count(DeduplicatedModel.del_stavbe_id).label('point_count'),
            func.avg(ST_X(DeduplicatedModel.coordinates)).label('avg_lng'),
            func.avg(ST_Y(DeduplicatedModel.coordinates)).label('avg_lat'),
            DeduplicatedModel.obcina,
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe,
            func.array_agg(DeduplicatedModel.del_stavbe_id).label('deduplicated_ids')
        )
        
        query_filters = []
        matched_municipality = None
        
        if sifko:
            query_filters.append(DeduplicatedModel.sifra_ko == sifko)
            print(f"Loading ALL properties for sifko: {sifko}")
            
        elif municipality:
            # Uporabi string similarity za municipality
            all_municipalities = db.query(DeduplicatedModel.obcina).distinct().all()
            available_municipalities = [m[0] for m in all_municipalities if m[0]]
            
            matched_municipality = find_best_municipality_match(municipality, available_municipalities)
            
            if matched_municipality:
                query_filters.append(DeduplicatedModel.obcina == matched_municipality)
                print(f"Loading ALL properties for municipality: {matched_municipality}")
            else:
                print(f"No matching municipality found for '{municipality}'")
                # Vrni prazen rezultat
                return {"type": "FeatureCollection", "features": []}
        
        if not query_filters:
            # Ni nobenega filtra, vrni prazen rezultat
            return {"type": "FeatureCollection", "features": []}
        
        # filtri za KO in navadne obcine
        base_query = base_query.filter(*query_filters)
        
        # filtri za nepremicnine
        base_query = apply_del_stavbe_filters(base_query, DeduplicatedModel, filters, data_source)
        
        # Building clustering - grupiraj po stavbah znotraj občine
        cluster_query = base_query.group_by(
            DeduplicatedModel.obcina,
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe
        ).all()
        
        print(f"Found {len(cluster_query)} building clusters in municipality")
        
        features = []
        for row in cluster_query:
            if row.point_count == 1:
                # Single point - vrni kot individualno dedupliciran del_stavbe
                feature = DelStavbeService._get_individual_deduplicated_property_feature(
                    db, DeduplicatedModel, row.deduplicated_ids[0], data_source
                )
                if feature:
                    features.append(feature)
            else:
                # Multicluster

                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(row.avg_lng), float(row.avg_lat)]
                    },
                    "properties": {
                        "type": "cluster",
                        "cluster_type": "building",
                        "point_count": len(row),
                        "cluster_id": f"b_{matched_municipality or row.obcina}_{row.sifra_ko}_{row.stevilka_stavbe}",
                        "obcina": matched_municipality or row.obcina,
                        "sifra_ko": row.sifra_ko,
                        "stevilka_stavbe": row.stevilka_stavbe,
                        "data_source": data_source,
                        "deduplicated_id": row.deduplicated_ids
                    }
                }
                features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features
        }
    
    
    @staticmethod
    def _get_individual_deduplicated_property_feature(db: Session, DeduplicatedModel, deduplicated_id: int, data_source: str):
        """
        Helper za pridobitev osnovnih podatkov deduplicirane nepremičnine za prikaz na zemljevidu
        (brez vseh podrobnosti - te pridobiš z get_property_details)
        """
        

        dedup_property = db.query(
            DeduplicatedModel,
            ST_X(DeduplicatedModel.coordinates).label('longitude'),
            ST_Y(DeduplicatedModel.coordinates).label('latitude')
        ).filter(
            DeduplicatedModel.del_stavbe_id == deduplicated_id,
        ).first()
        
        if not dedup_property:
            return None
        
        # Določi stevilo_poslov na podlagi podatkov v tabeli
        stevilo_poslov = len(dedup_property[0].povezani_posel_ids) if dedup_property[0].povezani_posel_ids else 0
        
        # Priprava osnovnih posel podatkov glede na data_source
        zadnji_posel_info = {}
        del_stavbe_np_dodatno = {}
        if data_source.lower() == "np":
            del_stavbe_np_dodatno = {
            }

            zadnji_posel_info = {
                "zadnja_najemnina": float(dedup_property[0].zadnja_najemnina),
                "zadnje_vkljuceno_stroski": dedup_property[0].zadnje_vkljuceno_stroski,
                "zadnje_vkljuceno_ddv": dedup_property[0].zadnje_vkljuceno_ddv,
                "zadnja_stopnja_ddv": float(dedup_property[0].zadnja_stopnja_ddv) if dedup_property[0].zadnja_stopnja_ddv else None,
           }
        else:  # kpp
            zadnji_posel_info = {
                "zadnja_cena": float(dedup_property[0].zadnja_cena),
                "zadnje_vkljuceno_ddv": dedup_property[0].zadnje_vkljuceno_ddv,
                "zadnja_stopnja_ddv": float(dedup_property[0].zadnja_stopnja_ddv) if dedup_property[0].zadnja_stopnja_ddv else None,
            }
        
        return {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(dedup_property.longitude), float(dedup_property.latitude)]
            },
            "properties": {
                "id": dedup_property[0].del_stavbe_id,
                "type": "individual",
                
                "sifra_ko": dedup_property[0].sifra_ko,
                "stevilka_stavbe": dedup_property[0].stevilka_stavbe,
                "stevilka_dela_stavbe": dedup_property[0].stevilka_dela_stavbe,
                "dejanska_raba": dedup_property[0].dejanska_raba,
                
                "obcina": dedup_property[0].obcina,
                "naselje": dedup_property[0].naselje,
                "ulica": dedup_property[0].ulica,
                "hisna_stevilka": dedup_property[0].hisna_stevilka,
                "dodatek_hs": dedup_property[0].dodatek_hs,
                "stev_stanovanja": dedup_property[0].stev_stanovanja,
                
                "povrsina_uradna": float(dedup_property[0].povrsina_uradna) if dedup_property[0].povrsina_uradna else None,
                "povrsina_uporabna": float(dedup_property[0].povrsina_uporabna) if dedup_property[0].povrsina_uporabna else None,
                **del_stavbe_np_dodatno,  # samo za np

                "leto_izgradnje_stavbe": dedup_property[0].leto_izgradnje_stavbe,
                
                **({"opremljenost": dedup_property[0].opremljenost} if data_source.lower() == "np" else {}),
                **({"stevilo_sob": dedup_property[0].stevilo_sob} if data_source.lower() == "kpp" else {}),
                
                "stevilo_poslov": stevilo_poslov,
                "ima_vec_poslov": stevilo_poslov > 1,
                "zadnje_leto": dedup_property[0].zadnje_leto,
                
                **zadnji_posel_info,

                "energetske_izkaznice": dedup_property[0].energetske_izkaznice,
                "energijski_razred": dedup_property[0].energijski_razred,

                "data_source": data_source
            }
        }

def get_municipality_similarity(name1: str, name2: str) -> float:
    """
    Izračuna similarity med dvema imenoma občin.
    Vrne vrednost med 0 in 1, kjer 1 pomeni popolno ujemanje.
    """
    if not name1 or not name2:
        return 0.0
    
    # Normaliziraj imena (lowercase, remove spaces)
    name1_norm = name1.lower().strip().replace(' ', '')
    name2_norm = name2.lower().strip().replace(' ', '')
    
    # Exact match
    if name1_norm == name2_norm:
        return 1.0
    
    # Sequence similarity
    return SequenceMatcher(None, name1_norm, name2_norm).ratio()


def find_best_municipality_match(target_municipality: str, available_municipalities: list, threshold: float = 0.8) -> str:
    """
    Najde najboljše ujemanje za ime občine iz seznama razpoložljivih občin.
    """
    if not target_municipality or not available_municipalities:
        return None
    
    best_match = None
    best_score = 0.0
    
    for municipality in available_municipalities:
        if municipality:
            score = get_municipality_similarity(target_municipality, municipality)
            if score > best_score and score >= threshold:
                best_score = score
                best_match = municipality
    
    print(f"Municipality matching: '{target_municipality}' -> '{best_match}' (score: {best_score:.3f})")
    return best_match