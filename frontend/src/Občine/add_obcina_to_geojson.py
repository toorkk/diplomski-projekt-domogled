#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Skripta za dodajanje imen občin v KatObčine.json GeoJSON datoteko
na podlagi mapiranja iz CSV datoteke Obcina_sifra.csv

Avtor: Assistant
Datum: 2025
"""

import json
import csv
import sys
from pathlib import Path

def load_csv_mapping(csv_file_path):
    """
    Naloži mapiranje SIFKO -> Občina iz CSV datoteke
    
    Args:
        csv_file_path (str): Pot do CSV datoteke
        
    Returns:
        dict: Slovar {sifko: obcina_ime}
    """
    mapping = {}
    
    try:
        with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
            # Poskusi z različnimi delimiters
            sample = csvfile.read(1024)
            csvfile.seek(0)
            
            # Določi delimiter
            if ',' in sample:
                delimiter = ','
            elif ';' in sample:
                delimiter = ';'
            else:
                delimiter = ','
            
            reader = csv.DictReader(csvfile, delimiter=delimiter)
            
            print(f"CSV headers: {reader.fieldnames}")
            
            for row_num, row in enumerate(reader, 1):
                try:
                    # Pridobi SIFKO in ime občine
                    sifko = row.get('sifra_ko') or row.get('SIFKO') or row.get('sifko')
                    obcina = row.get('obcina') or row.get('OBCINA') or row.get('Obcina')
                    
                    if sifko and obcina:
                        # Konvertiraj SIFKO v int
                        sifko_int = int(sifko)
                        obcina_clean = obcina.strip()
                        
                        mapping[sifko_int] = obcina_clean
                        
                        if row_num <= 5:  # Debug prvih 5 vrstic
                            print(f"Mapped: SIFKO {sifko_int} -> {obcina_clean}")
                    
                except (ValueError, TypeError) as e:
                    print(f"Warning: Napaka v vrstici {row_num}: {e}")
                    continue
        
        print(f"✅ Uspešno naloženih {len(mapping)} mapiranj iz CSV")
        return mapping
        
    except FileNotFoundError:
        print(f"❌ CSV datoteka ni bila najdena: {csv_file_path}")
        return {}
    except Exception as e:
        print(f"❌ Napaka pri branju CSV: {e}")
        return {}

def process_geojson(geojson_file_path, mapping, output_file_path):
    """
    Obdela GeoJSON datoteko in doda imena občin
    
    Args:
        geojson_file_path (str): Pot do vhodne GeoJSON datoteke
        mapping (dict): Mapiranje SIFKO -> Občina
        output_file_path (str): Pot do izhodne datoteke
    """
    
    try:
        # Naloži GeoJSON
        with open(geojson_file_path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        
        print(f"✅ Naložen GeoJSON z {len(geojson_data.get('features', []))} features")
        
        # Statistike
        matched_count = 0
        unmatched_count = 0
        unmatched_sifkos = []
        
        # Obdeli vsak feature
        for i, feature in enumerate(geojson_data.get('features', [])):
            properties = feature.get('properties', {})
            sifko = properties.get('SIFKO')
            
            if sifko is not None:
                # Poskusi najti občino za ta SIFKO
                obcina_ime = mapping.get(sifko)
                
                if obcina_ime:
                    # Dodaj ime občine v properties
                    properties['OBCINA'] = obcina_ime
                    matched_count += 1
                    
                    if i < 5:  # Debug prvih 5
                        print(f"Feature {i}: SIFKO {sifko} -> {obcina_ime}")
                        
                else:
                    # Ni mapiranja za ta SIFKO
                    properties['OBCINA'] = None
                    unmatched_count += 1
                    unmatched_sifkos.append(sifko)
                    
            else:
                print(f"Warning: Feature {i} nima SIFKO property")
                properties['OBCINA'] = None
                unmatched_count += 1
        
        # Shrani posodobljen GeoJSON
        with open(output_file_path, 'w', encoding='utf-8') as f:
            json.dump(geojson_data, f, ensure_ascii=False, indent=2)
        
        # Izpiši statistike
        total_features = len(geojson_data.get('features', []))
        print(f"\n📊 STATISTIKE:")
        print(f"   Skupaj features: {total_features}")
        print(f"   ✅ Ujemanja: {matched_count}")
        print(f"   ❌ Brez ujemanja: {unmatched_count}")
        print(f"   📈 Uspešnost: {(matched_count/total_features*100):.1f}%")
        
        if unmatched_sifkos:
            print(f"\n⚠️  SIFKO brez ujemanja (prvih 20):")
            for sifko in sorted(set(unmatched_sifkos))[:20]:
                print(f"   - {sifko}")
        
        print(f"\n✅ Posodobljen GeoJSON shranjen v: {output_file_path}")
        
    except FileNotFoundError:
        print(f"❌ GeoJSON datoteka ni bila najdena: {geojson_file_path}")
    except json.JSONDecodeError as e:
        print(f"❌ Napaka pri branju JSON: {e}")
    except Exception as e:
        print(f"❌ Neznana napaka: {e}")

def main():
    """Glavna funkcija"""
    
    print("🚀 Dodajanje imen občin v KatObčine.json")
    print("=" * 50)
    
    # Pot do datotek (relativno glede na trenutni direktorij)
    csv_file = "Občine/Obcina_sifra.csv"
    input_geojson = "Občine/KatObčine.json"
    output_geojson = "Občine/KatObčine_z_obcinami.json"
    
    # Preveri ali datoteke obstajajo
    if not Path(csv_file).exists():
        print(f"❌ CSV datoteka ne obstaja: {csv_file}")
        print("   Preveri pot ali postavi datoteko v pravi direktorij")
        sys.exit(1)
    
    if not Path(input_geojson).exists():
        print(f"❌ GeoJSON datoteka ne obstaja: {input_geojson}")
        print("   Preveri pot ali postavi datoteko v pravi direktorij")
        sys.exit(1)
    
    # Korak 1: Naloži mapiranje iz CSV
    print("1️⃣ Nalagam mapiranje SIFKO -> Občina iz CSV...")
    mapping = load_csv_mapping(csv_file)
    
    if not mapping:
        print("❌ Ni bilo mogoče naložiti mapiranja iz CSV")
        sys.exit(1)
    
    # Prikaži nekaj primerov mapiranja
    print(f"\n📋 Primeri mapiranja (prvih 10):")
    for i, (sifko, obcina) in enumerate(list(mapping.items())[:10]):
        print(f"   {sifko} -> {obcina}")
    
    # Korak 2: Obdela GeoJSON
    print(f"\n2️⃣ Obdelavam GeoJSON datoteko...")
    process_geojson(input_geojson, mapping, output_geojson)
    
    print(f"\n🎉 Končano! Nova datoteka: {output_geojson}")
    print("\nNaslednji koraki:")
    print(f"1. Preimenuj {output_geojson} v KatObčine.json")
    print("2. Posodobi kodo da uporablja novo 'OBCINA' property")

if __name__ == "__main__":
    main()