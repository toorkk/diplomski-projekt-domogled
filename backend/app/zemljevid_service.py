from sqlalchemy import func
from sqlalchemy.orm import Session
from geoalchemy2.functions import ST_SetSRID, ST_MakeEnvelope, ST_Intersects, ST_X, ST_Y, ST_Distance, ST_Transform
from difflib import SequenceMatcher

from .models import EnergetskaIzkaznica

from .clustering_utils import calculate_cluster_resolution, get_deduplicated_del_stavbe_model, get_del_stave_model, get_posel_model, serialize_list_to_json, apply_del_stavbe_filters, serialize_to_json


class DelStavbeService:


########################
#
#   DISTANCE CLUSTERING
#
########################


    @staticmethod
    def get_distance_clustered_del_stavbe(west: float, south: float, east: float, north: float, zoom: float, db: Session, data_source: str = "np", filters: dict = None):
        """
        Pridobi deduplicirane nepremičnine združene po: občina + razdalji med sabo (clustering znotraj posamezne občine)
        Uporabljeno ko si zoomed out
        """
        DeduplicatedModel = get_deduplicated_del_stavbe_model(data_source)
        resolution = calculate_cluster_resolution(zoom)
        bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)
        
        # SQL query - vse del stavbe v bbox-u
        base_query = db.query(
            DeduplicatedModel.del_stavbe_id,
            DeduplicatedModel.obcina,
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe,
            DeduplicatedModel.stevilka_dela_stavbe,
            ST_X(DeduplicatedModel.coordinates).label('lng'),
            ST_Y(DeduplicatedModel.coordinates).label('lat'),
            DeduplicatedModel.dejanska_raba,
        )

        if zoom >= 8.6: 
            base_query = base_query.filter(ST_Intersects(DeduplicatedModel.coordinates, bbox_geom))   


        base_query = apply_del_stavbe_filters(base_query, DeduplicatedModel, filters, data_source)
        
        # Dodaj data_source specifične podatke
        if data_source.lower() == "np":
            base_query = base_query.add_columns(
                DeduplicatedModel.opremljenost,
                DeduplicatedModel.zadnja_najemnina,
                DeduplicatedModel.zadnje_vkljuceno_stroski,
                DeduplicatedModel.zadnje_vkljuceno_ddv,
                DeduplicatedModel.zadnja_stopnja_ddv
            )
        else:  # kpp
            base_query = base_query.add_columns(
                DeduplicatedModel.stevilo_sob,
                DeduplicatedModel.zadnja_cena,
                DeduplicatedModel.zadnje_vkljuceno_ddv,
                DeduplicatedModel.zadnja_stopnja_ddv
            )
        
        all_del_stavbe = base_query.all()

        
        # 2. Python clustering po distance grid
        distance_groups = {}
        for ds in all_del_stavbe:
            # Distance clustering - grid coordinates
            cluster_x = int(ds.lng / resolution)
            cluster_y = int(ds.lat / resolution)
            cluster_key = f"{ds.obcina}_{cluster_x}_{cluster_y}"
            
            if cluster_key not in distance_groups:
                distance_groups[cluster_key] = []
            distance_groups[cluster_key].append(ds)
        

        # 3. Generiraj features
        features = []
        for cluster_key, del_stavbe in distance_groups.items():
            if len(del_stavbe) == 1:
                # individualni del stavbe
                ds = del_stavbe[0]
                cluster_x = int(ds.lng / resolution)
                cluster_y = int(ds.lat / resolution)

                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [ds.lng, ds.lat]
                    },
                    "properties": {
                        "type": "cluster",
                        "cluster_type": "distance",
                        "point_count": 1,
                        "cluster_id": f"d_{ds.obcina}_{cluster_x}_{cluster_y}",
                        "obcina": ds.obcina,
                        "data_source": data_source,
                        "deduplicated_id": ds.del_stavbe_id
                    }
                }
            else:
                # distance multicluster
                avg_lng = sum(float(ds.lng) for ds in del_stavbe) / len(del_stavbe)
                avg_lat = sum(float(ds.lat) for ds in del_stavbe) / len(del_stavbe)
                
                first_ds = del_stavbe[0]
                cluster_x = int(first_ds.lng / resolution)
                cluster_y = int(first_ds.lat / resolution)
                
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [avg_lng, avg_lat]
                    },
                    "properties": {
                        "type": "cluster",
                        "cluster_type": "distance",
                        "point_count": len(del_stavbe),
                        "cluster_id": f"d_{first_ds.obcina}_{cluster_x}_{cluster_y}",
                        "obcina": first_ds.obcina,
                        "data_source": data_source,
                        "deduplicated_ids": [ds.del_stavbe_id for ds in del_stavbe]
                    }
                }
            
            features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features
        }
    


#########################
#
#   BUILDING CLUSTERING
#
#########################


    @staticmethod
    def get_building_clustered_del_stavbe(west: float, south: float, east: float, north: float, db: Session, data_source: str = "np", filters: dict = None):
        """
        Pridobi deduplicirane nepremičnine združene po: občina + sifra_ko + stevilka_stavbe (naredi cluster za vsako stavbo znotraj občine)
        Uporabljeno ko si zoomed in
        """

        DeduplicatedModel = get_deduplicated_del_stavbe_model(data_source)
        bbox_geom = ST_SetSRID(ST_MakeEnvelope(west, south, east, north), 4326)

        base_query = DelStavbeService._build_del_stavbe_query(db, DeduplicatedModel, data_source)
        base_query = base_query.filter(ST_Intersects(DeduplicatedModel.coordinates, bbox_geom))
        base_query = apply_del_stavbe_filters(base_query, DeduplicatedModel, filters, data_source)
        
        all_del_stavbe = base_query.all()


        # Python clustering po stavbah
        building_groups = {}
        for ds in all_del_stavbe:
            building_key = f"{ds.obcina}_{ds.sifra_ko}_{ds.stevilka_stavbe}"
            if building_key not in building_groups:
                building_groups[building_key] = []
            building_groups[building_key].append(ds)
        

        # Generiraj features
        features = []
        for building_key, del_stavbe in building_groups.items():
            if len(del_stavbe) == 1:
                feature = DelStavbeService._create_del_stavbe_feature_json(del_stavbe[0], data_source)
            else:

                avg_lng = sum(float(p.lng) for p in del_stavbe) / len(del_stavbe)
                avg_lat = sum(float(p.lat) for p in del_stavbe) / len(del_stavbe)

                first_ds = del_stavbe[0]  # Vsi v isti stavbi imajo iste osnovne podatke
                
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [avg_lng, avg_lat]
                    },
                    "properties": {
                        "type": "cluster",
                        "cluster_type": "building",
                        "point_count": len(del_stavbe),
                        "cluster_id": f"b_{first_ds.obcina}_{first_ds.sifra_ko}_{first_ds.stevilka_stavbe}",
                        "obcina": first_ds.obcina,
                        "sifra_ko": first_ds.sifra_ko,
                        "stevilka_stavbe": first_ds.stevilka_stavbe,
                        "data_source": data_source,
                        "deduplicated_ids": [ds.del_stavbe_id for ds in del_stavbe]
                    }
                }
            
            features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features
        }
    

    @staticmethod
    def get_stavba_multicluster(obcina: str, sifra_ko: int, stevilka_stavbe: int, db: Session, data_source: str = "np", filters: dict = None):
        """
        Pridobi vse deduplicirane nepremičnine v določeni stavbi (enem multiclusterju)
        """
        DeduplicatedModel = get_deduplicated_del_stavbe_model(data_source)
        
        base_query = DelStavbeService._build_del_stavbe_query(db, DeduplicatedModel, data_source)
        
        # filter da dobis tocno to stavbo
        base_query = base_query.filter(
            DeduplicatedModel.obcina == obcina,
            DeduplicatedModel.sifra_ko == sifra_ko,
            DeduplicatedModel.stevilka_stavbe == stevilka_stavbe
        )
        
        base_query = apply_del_stavbe_filters(base_query, DeduplicatedModel, filters, data_source)
        
        all_del_stavbe = base_query.all()
                

        # generiraj features
        features = []
        skipped_del_stavbe = 0
        
        for ds in all_del_stavbe:
            try:
                feature = DelStavbeService._create_del_stavbe_feature_json(ds, data_source)
                features.append(feature)
            except Exception as e:
                print(f"NAPAKA PRI DELU STAVBE Z ID {ds.del_stavbe_id}: {str(e)}")
                skipped_del_stavbe += 1
                continue
        
        if skipped_del_stavbe > 0:
            print(f"OPOZORILO: PRESKOČENIH {skipped_del_stavbe} DEDUPLICIRANIH DELOV STAVB")
        
        return {
            "type": "FeatureCollection", 
            "features": features,
            "cluster_info": {
                "cluster_id": f"b_{obcina}_{sifra_ko}_{stevilka_stavbe}",
                "total_properties": len(features),
                "skipped_properties": skipped_del_stavbe,
                "obcina": obcina,
                "sifra_ko": sifra_ko,
                "stevilka_stavbe": stevilka_stavbe
            }
        }
        

    @staticmethod
    def get_del_stavbe_details(deduplicated_id: int, data_source: str, db: Session):
        """
        Pridobi podrobnosti za določeno deduplicirano nepremičnino (ko kliknemo podrobnosti v pop-up).
        Vrne vse povezane posel, del_stavbe, energetska_izkaznica.
        """
        DeduplicatedModel = get_deduplicated_del_stavbe_model(data_source)
        DelStavbeModel = get_del_stave_model(data_source)
        PoselModel = get_posel_model(data_source)

        
        # Pridobi deduplicirani zapis nepremičnine
        dedup_del_stavbe = db.query(
            DeduplicatedModel,
            ST_X(DeduplicatedModel.coordinates).label('longitude'),
            ST_Y(DeduplicatedModel.coordinates).label('latitude')
        ).filter(
            DeduplicatedModel.del_stavbe_id == deduplicated_id
        ).first()
        
        if not dedup_del_stavbe:
            return None
        

        # Pridobi vse povezane del_stavbe zapise, povezane posle, reprezentativni (zadnji) del stavbe in energetske izkaznice
        vsi_povezani_deli_stavb = db.query(DelStavbeModel).filter(
            DelStavbeModel.del_stavbe_id.in_(dedup_del_stavbe[0].povezani_del_stavbe_ids)
        ).order_by(
            DelStavbeModel.stevilka_stavbe.asc().nulls_last(),
            DelStavbeModel.stevilka_dela_stavbe.asc().nulls_last()
        ).all()

        vsi_posli = db.query(PoselModel).filter(
            PoselModel.posel_id.in_(dedup_del_stavbe[0].povezani_posel_ids)
        ).order_by(
            PoselModel.datum_sklenitve.desc().nulls_last(),
            PoselModel.datum_uveljavitve.desc().nulls_last()
        ).all()
        
        representative_del_stavbe = db.query(DelStavbeModel).filter(
            DelStavbeModel.del_stavbe_id == dedup_del_stavbe[0].najnovejsi_del_stavbe_id
        ).first()

        if dedup_del_stavbe[0].energetske_izkaznice:
            energetske_izkaznice = db.query(EnergetskaIzkaznica).filter(
                EnergetskaIzkaznica.id.in_(dedup_del_stavbe[0].energetske_izkaznice)
            ).all()
        else:
            energetske_izkaznice = []


        if not representative_del_stavbe:
            return None
        
        
        return {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    float(dedup_del_stavbe.longitude),
                    float(dedup_del_stavbe.latitude)
                ]
            },
            "properties": {
                "deduplicated_id": dedup_del_stavbe[0].del_stavbe_id,
                "type": "individual",
                "data_source": data_source,

                "reprezentativni_del_stavbe": serialize_to_json(representative_del_stavbe),  
                
                "stevilo_poslov": len(dedup_del_stavbe[0].povezani_posel_ids),
                "ima_vec_poslov": len(dedup_del_stavbe[0].povezani_posel_ids) > 1,
                
                "povezani_deli_stavb": serialize_list_to_json(vsi_povezani_deli_stavb),
                "povezani_posli": serialize_list_to_json(vsi_posli),
                "energetske_izkaznice": serialize_list_to_json(energetske_izkaznice)
            }
        }
    


######################
#
#   PODOBNE NEPREMICNINE
#
######################

    @staticmethod
    def get_podobne_nepremicnine(deduplicated_id: int, data_source: str, limit: int, radius_km: float, db: Session):
        """
        Pridobi podobne nepremičnine glede na določeno nepremičnino.
        
        Kriteriji podobnosti:
        1. Ista vrsta nepremičnine (stanovanje/hiša)
        2. Podobna površina (±30%)
        3. Lokacija v določenem polmeru
        4. Podobna cena (±40%)
        5. Podobna starost stavbe (±15 let)
        """
        try:
            print(f"DEBUG: Začenjam iskanje podobnih nepremičnin za ID {deduplicated_id}")
            
            DeduplicatedModel = get_deduplicated_del_stavbe_model(data_source)
            print(f"DEBUG: Model uspešno pridobljen za {data_source}")
            
            # 1. Pridobi referenčno nepremičnino
            reference = db.query(DeduplicatedModel).filter(
                DeduplicatedModel.del_stavbe_id == deduplicated_id
            ).first()
            
            if not reference:
                print(f"DEBUG: Referenčna nepremičnina {deduplicated_id} ni bila najdena")
                return {"status": "error", "message": "Referenčna nepremičnina ni bila najdena"}
            
            print(f"DEBUG: Referenčna nepremičnina najdena: vrsta={reference.vrsta_nepremicnine}")
            
            # 2. Določi kriterije iskanja
            vrsta_nepremicnine = reference.vrsta_nepremicnine
            povrsina = reference.povrsina_uradna or reference.povrsina_uporabna
            leto_izgradnje = reference.leto_izgradnje_stavbe
            
            print(f"DEBUG: Kriteriji - vrsta: {vrsta_nepremicnine}, površina: {povrsina}, leto: {leto_izgradnje}")
            
            # Cena/najemnina
            if data_source.lower() == "np":
                referenca_cena = reference.zadnja_najemnina
            else:
                referenca_cena = reference.zadnja_cena
                
            print(f"DEBUG: Referenčna cena: {referenca_cena}")
            
            # 3. Osnovni query z filtri
            base_query = db.query(
                DeduplicatedModel,
                ST_Distance(
                    ST_Transform(DeduplicatedModel.coordinates, 3857),
                    ST_Transform(reference.coordinates, 3857)
                ).label('distance_m')
            ).filter(
                DeduplicatedModel.del_stavbe_id != deduplicated_id,  # Izključi sebe
                DeduplicatedModel.vrsta_nepremicnine == vrsta_nepremicnine  # Ista vrsta
            )
            
            print("DEBUG: Osnovni query ustvarjen")
            
            # Filter za polmer (v metrih)
            radius_m = radius_km * 1000
            base_query = base_query.filter(
                ST_Distance(
                    ST_Transform(DeduplicatedModel.coordinates, 3857),
                    ST_Transform(reference.coordinates, 3857)
                ) <= radius_m
            )
            
            print(f"DEBUG: Polmer filter dodan: {radius_km}km")
            
            # Filter za površino (±30%)
            if povrsina:
                try:
                    povrsina = float(povrsina)
                    min_povrsina = povrsina * 0.85
                    max_povrsina = povrsina * 1.15
                    base_query = base_query.filter(
                        ((DeduplicatedModel.povrsina_uradna >= min_povrsina) & 
                        (DeduplicatedModel.povrsina_uradna <= max_povrsina)) |
                        ((DeduplicatedModel.povrsina_uporabna >= min_povrsina) & 
                        (DeduplicatedModel.povrsina_uporabna <= max_povrsina))
                    )
                    print(f"DEBUG: Površina filter dodan: {min_povrsina}-{max_povrsina}m²")
                except Exception as e:
                    print(f"DEBUG: Napaka pri površina filtru: {e}")
            
            # Filter za leto izgradnje (±15 let)
            if leto_izgradnje:
                try:
                    min_leto = leto_izgradnje - 10
                    max_leto = leto_izgradnje + 10
                    base_query = base_query.filter(
                        (DeduplicatedModel.leto_izgradnje_stavbe >= min_leto) &
                        (DeduplicatedModel.leto_izgradnje_stavbe <= max_leto)
                    )
                    print(f"DEBUG: Leto filter dodan: {min_leto}-{max_leto}")
                except Exception as e:
                    print(f"DEBUG: Napaka pri leto filtru: {e}")
            
            # Filter za ceno (±40%)
            if referenca_cena:
                try:
                    referenca_cena = float(referenca_cena)
                    min_cena = referenca_cena * 0.85
                    max_cena = referenca_cena * 1.15
                    
                    if data_source.lower() == "np":
                        base_query = base_query.filter(
                            (DeduplicatedModel.zadnja_najemnina >= min_cena) &
                            (DeduplicatedModel.zadnja_najemnina <= max_cena)
                        )
                    else:
                        base_query = base_query.filter(
                            (DeduplicatedModel.zadnja_cena >= min_cena) &
                            (DeduplicatedModel.zadnja_cena <= max_cena)
                        )
                    print(f"DEBUG: Cena filter dodan: {min_cena}-{max_cena}")
                except Exception as e:
                    print(f"DEBUG: Napaka pri cena filtru: {e}")
            
            # 4. Izvedi query
            print("DEBUG: Izvajam query...")
            kandidati = base_query.all()
            print(f"DEBUG: Najdenih {len(kandidati)} kandidatov")
            
            # 5. Izračunaj similarity score za vse kandidate
            scored_kandidati = []
            for i, (kandidat, distance_m) in enumerate(kandidati):
                try:
                    score = DelStavbeService._calculate_similarity_score(
                        reference, kandidat, distance_m, data_source
                    )
                    scored_kandidati.append((kandidat, distance_m, score))
                    if i < 3:  # Log prvih nekaj
                        print(f"DEBUG: Kandidat {i}: score={score}, distance={distance_m}m")
                except Exception as e:
                    print(f"DEBUG: Napaka pri score računanju za kandidata {i}: {e}")
                    continue
            
            # 6. Sortiraj po similarity score (višji = bolj podoben)
            scored_kandidati.sort(key=lambda x: x[2], reverse=True)
            
            # 7. Vzemi top N rezultatov
            top_kandidati = scored_kandidati[:limit]
            print(f"DEBUG: Izbranjih top {len(top_kandidati)} kandidatov")
            
            # 8. Formatiraj rezultat
            podobne_nepremicnine = []
            for i, (kandidat, distance_m, score) in enumerate(top_kandidati):
                try:
                    print(f"DEBUG: Formatiranje kandidata {i}, ID: {kandidat.del_stavbe_id}")
                    
                    
                    try:
                        naslov = DelStavbeService._format_naslov(kandidat)
                        print(f"DEBUG: Naslov OK: {naslov}")
                    except Exception as e:
                        print(f"DEBUG: Napaka pri naslovu: {e}")
                        naslov = "Neznan naslov"
                    
                    try:
                        povrsina = kandidat.povrsina_uradna or kandidat.povrsina_uporabna
                        povrsina = float(povrsina) if povrsina else None
                        print(f"DEBUG: Površina OK: {povrsina}")
                    except Exception as e:
                        print(f"DEBUG: Napaka pri površini: {e}")
                        povrsina = None
                    
                    try:
                        if data_source.lower() == "np":
                            cena = float(kandidat.zadnja_najemnina) if kandidat.zadnja_najemnina else None
                        else:
                            cena = float(kandidat.zadnja_cena) if kandidat.zadnja_cena else None
                        print(f"DEBUG: Cena OK: {cena}")
                    except Exception as e:
                        print(f"DEBUG: Napaka pri ceni: {e}")
                        cena = None
                    
                    try:
                        leto = int(kandidat.leto_izgradnje_stavbe) if kandidat.leto_izgradnje_stavbe else None
                        print(f"DEBUG: Leto OK: {leto}")
                    except Exception as e:
                        print(f"DEBUG: Napaka pri letu: {e}")
                        leto = None
                    
                    try:
                        distance_km = round(float(distance_m) / 1000, 2)
                        print(f"DEBUG: Distance OK: {distance_km}")
                    except Exception as e:
                        print(f"DEBUG: Napaka pri distance: {e}")
                        distance_km = 0
                    
                    try:
                        coords = None
                        if kandidat.coordinates:
                            coords = [float(kandidat.coordinates.x), float(kandidat.coordinates.y)]
                        print(f"DEBUG: Coordinates OK: {coords}")
                    except Exception as e:
                        print(f"DEBUG: Napaka pri coordinates: {e}")
                        coords = None
                    
                    # Sestavimo objekt
                    podobna_nepremicnina = {
                        "del_stavbe_id": kandidat.del_stavbe_id,
                        "naslov": naslov,
                        "povrsina": povrsina,
                        "cena": cena,
                        "leto_izgradnje": leto,
                        "energijski_razred": kandidat.energijski_razred,
                        "distance_km": distance_km,
                        "similarity_score": round(float(score), 2),
                        "obcina": kandidat.obcina,
                        "coordinates": coords
                    }
                    
                    podobne_nepremicnine.append(podobna_nepremicnina)
                    print(f"DEBUG: Kandidat {i} uspešno formatiran")
                    
                except Exception as e:
                    import traceback
                    print(f"DEBUG: Napaka pri formatiranju kandidata {i}: {e}")
                    print(f"DEBUG: Traceback: {traceback.format_exc()}")
                    continue
            
            print(f"DEBUG: Končno vračam {len(podobne_nepremicnine)} podobnih nepremičnin")
            
            return {
                "status": "success",
                "data": {
                    "reference_id": deduplicated_id,
                    "total_found": len(scored_kandidati),
                    "returned": len(podobne_nepremicnine),
                    "search_radius_km": radius_km,
                    "podobne_nepremicnine": podobne_nepremicnine
                }
            }
            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"DEBUG: Celotna napaka: {e}")
            print(f"DEBUG: Traceback: {error_details}")
            return {"status": "error", "message": f"Napaka pri iskanju podobnih nepremičnin: {str(e)} | Traceback: {error_details}"}
        

    @staticmethod
    def _calculate_similarity_score(reference, kandidat, distance_m, data_source):
        """
        Izračuna similarity score (0-100) na podlagi različnih kriterijev.
        Višji score = bolj podoben.
        """
        score = 0
        max_score = 0
        
        # 1. Površina (30 točk)
        ref_povrsina = reference.povrsina_uradna or reference.povrsina_uporabna
        kan_povrsina = kandidat.povrsina_uradna or kandidat.povrsina_uporabna
        
        if ref_povrsina and kan_povrsina:
            # Konvertiraj v float za računanje
            ref_povrsina = float(ref_povrsina)
            kan_povrsina = float(kan_povrsina)
            
            povrsina_diff = abs(ref_povrsina - kan_povrsina) / ref_povrsina
            povrsina_score = max(0, 30 * (1 - povrsina_diff))
            score += povrsina_score
        max_score += 30
        
        # 2. Cena (25 točk)
        if data_source.lower() == "np":
            ref_cena = reference.zadnja_najemnina
            kan_cena = kandidat.zadnja_najemnina
        else:
            ref_cena = reference.zadnja_cena
            kan_cena = kandidat.zadnja_cena
        
        if ref_cena and kan_cena:
            # Konvertiraj v float za računanje
            ref_cena = float(ref_cena)
            kan_cena = float(kan_cena)
            
            cena_diff = abs(ref_cena - kan_cena) / ref_cena
            cena_score = max(0, 25 * (1 - cena_diff))
            score += cena_score
        max_score += 25
        
        # 3. Lokacija (20 točk) - bližje = boljše
        distance_km = float(distance_m) / 1000  # Konvertiraj distance_m v float
        if distance_km <= 1:
            location_score = 20
        elif distance_km <= 3:
            location_score = 15
        elif distance_km <= 5:
            location_score = 10
        else:
            location_score = max(0, 20 * (1 - (distance_km - 5) / 10))
        
        score += location_score
        max_score += 20
        
        # 4. Starost stavbe (15 točk)
        if reference.leto_izgradnje_stavbe and kandidat.leto_izgradnje_stavbe:
            # Konvertiraj v int/float za računanje
            ref_leto = int(reference.leto_izgradnje_stavbe)
            kan_leto = int(kandidat.leto_izgradnje_stavbe)
            
            leta_diff = abs(ref_leto - kan_leto)
            starost_score = max(0, 15 * (1 - leta_diff / 30))
            score += starost_score
        max_score += 15
        
        # 5. Energijski razred (10 točk)
        if reference.energijski_razred and kandidat.energijski_razred:
            energy_classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
            try:
                ref_idx = energy_classes.index(reference.energijski_razred)
                kan_idx = energy_classes.index(kandidat.energijski_razred)
                energy_diff = abs(ref_idx - kan_idx)
                energy_score = max(0, 10 * (1 - energy_diff / 6))
                score += energy_score
            except ValueError:
                pass  # Neznani energijski razred
        max_score += 10
        
        # Normaliziraj na 0-100
        if max_score > 0:
            normalized_score = (score / max_score) * 100
        else:
            normalized_score = 0
        
        return normalized_score
    

    @staticmethod
    def _format_naslov(nepremicnina):
        """Formatira naslov nepremičnine"""
        naslov_deli = []
        
        if nepremicnina.ulica:
            naslov_deli.append(nepremicnina.ulica)
        
        if nepremicnina.hisna_stevilka:
            naslov_deli.append(str(nepremicnina.hisna_stevilka))
            if nepremicnina.dodatek_hs:
                naslov_deli[-1] += nepremicnina.dodatek_hs
        
        if nepremicnina.naselje and nepremicnina.naselje != nepremicnina.obcina:
            naslov_deli.append(nepremicnina.naselje)
        
        if nepremicnina.obcina:
            naslov_deli.append(nepremicnina.obcina)
        
        return ", ".join(naslov_deli) if naslov_deli else "Neznan naslov"
    

######################
#
#   HELPER METODE
#
######################


    @staticmethod
    def _build_del_stavbe_query(db: Session, DeduplicatedModel, data_source: str):
        """
        Helper za individualni del stavbe query
        """
        base_query = db.query(
            DeduplicatedModel.del_stavbe_id,
            DeduplicatedModel.sifra_ko,
            DeduplicatedModel.stevilka_stavbe,
            DeduplicatedModel.stevilka_dela_stavbe,
            DeduplicatedModel.vrsta_nepremicnine,
            DeduplicatedModel.obcina,
            DeduplicatedModel.naselje,
            DeduplicatedModel.ulica,
            DeduplicatedModel.hisna_stevilka,
            DeduplicatedModel.dodatek_hs,
            DeduplicatedModel.stev_stanovanja,
            DeduplicatedModel.povrsina_uradna,
            DeduplicatedModel.povrsina_uporabna,
            DeduplicatedModel.leto_izgradnje_stavbe,
            DeduplicatedModel.zadnje_leto,
            DeduplicatedModel.zadnje_stevilo_delov_stavb,
            DeduplicatedModel.energetske_izkaznice,
            DeduplicatedModel.energijski_razred,
            DeduplicatedModel.povezani_posel_ids,
            DeduplicatedModel.povezani_del_stavbe_ids,
            ST_X(DeduplicatedModel.coordinates).label('lng'),
            ST_Y(DeduplicatedModel.coordinates).label('lat')
        )
        
        # Dodaj data_source specifične podatke
        if data_source.lower() == "np":
            base_query = base_query.add_columns(
                DeduplicatedModel.opremljenost,
                DeduplicatedModel.zadnja_najemnina,
                DeduplicatedModel.zadnje_vkljuceno_stroski,
                DeduplicatedModel.zadnje_vkljuceno_ddv,
                DeduplicatedModel.zadnja_stopnja_ddv
            )
        else:  # kpp
            base_query = base_query.add_columns(
                DeduplicatedModel.stevilo_sob,
                DeduplicatedModel.zadnja_cena,
                DeduplicatedModel.zadnje_vkljuceno_ddv,
                DeduplicatedModel.zadnja_stopnja_ddv
            )
        
        return base_query



    @staticmethod
    def _create_del_stavbe_feature_json(del_stavbe, data_source: str):
        """
        Helper za kreiranje individualnih del stavbe json feature responsov
        """

        zadnji_posel_info = {}
        del_stavbe_dodatno = {}
        
        if data_source.lower() == "np":
            del_stavbe_dodatno = {
                "opremljenost": del_stavbe.opremljenost
            }
            zadnji_posel_info = {
                "zadnja_najemnina": float(del_stavbe.zadnja_najemnina) if del_stavbe.zadnja_najemnina else None,
                "zadnje_vkljuceno_stroski": del_stavbe.zadnje_vkljuceno_stroski,
                "zadnje_vkljuceno_ddv": del_stavbe.zadnje_vkljuceno_ddv,
                "zadnja_stopnja_ddv": float(del_stavbe.zadnja_stopnja_ddv) if del_stavbe.zadnja_stopnja_ddv else None,
            }
        else:  # kpp
            del_stavbe_dodatno = {
                "stevilo_sob": del_stavbe.stevilo_sob
            }
            zadnji_posel_info = {
                "zadnja_cena": float(del_stavbe.zadnja_cena) if del_stavbe.zadnja_cena else None,
                "zadnje_vkljuceno_ddv": del_stavbe.zadnje_vkljuceno_ddv,
                "zadnja_stopnja_ddv": float(del_stavbe.zadnja_stopnja_ddv) if del_stavbe.zadnja_stopnja_ddv else None,
            }
        
        stevilo_poslov = len(del_stavbe.povezani_posel_ids) if del_stavbe.povezani_posel_ids else 0
        
        return {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(del_stavbe.lng), float(del_stavbe.lat)]
            },
            "properties": {
                "id": del_stavbe.del_stavbe_id,
                "type": "individual",
                
                "sifra_ko": del_stavbe.sifra_ko,
                "stevilka_stavbe": del_stavbe.stevilka_stavbe,
                "stevilka_dela_stavbe": del_stavbe.stevilka_dela_stavbe,
                "vrsta_nepremicnine": del_stavbe.vrsta_nepremicnine,
                
                "obcina": del_stavbe.obcina,
                "naselje": del_stavbe.naselje,
                "ulica": del_stavbe.ulica,
                "hisna_stevilka": del_stavbe.hisna_stevilka,
                "dodatek_hs": del_stavbe.dodatek_hs,
                "stev_stanovanja": del_stavbe.stev_stanovanja,
                
                "povrsina_uradna": del_stavbe.povrsina_uradna,
                "povrsina_uporabna": del_stavbe.povrsina_uporabna,
                **del_stavbe_dodatno,
                
                "leto_izgradnje_stavbe": del_stavbe.leto_izgradnje_stavbe,
                
                "stevilo_poslov": stevilo_poslov,
                "ima_vec_poslov": stevilo_poslov > 1,
                "zadnje_leto": del_stavbe.zadnje_leto,
                "zadnje_stevilo_delov_stavb": del_stavbe.zadnje_stevilo_delov_stavb,
                
                **zadnji_posel_info,
                
                "energetske_izkaznice": del_stavbe.energetske_izkaznice,
                "energijski_razred": del_stavbe.energijski_razred,
                
                "data_source": data_source
            }
        }