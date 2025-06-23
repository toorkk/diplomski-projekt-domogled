import json

def filtriraj_katastre(input_file, output_file):
    """
    Filtrira katastre in obdrži samo tiste za Maribor in Ljubljano
    """
    try:
        # Preberi originalni JSON file
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Filtriraj features - obdrži samo Maribor in Ljubljano
        filtered_features = []
        for feature in data['features']:
            obcina = feature['properties'].get('OBCINA', '')
            if obcina in ['MARIBOR', 'LJUBLJANA']:
                filtered_features.append(feature)
        
        # Ustvari novo strukturo z filtriranimi podatki
        filtered_data = data.copy()
        filtered_data['features'] = filtered_features
        
        # Shrani filtrirane podatke v novi file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(filtered_data, f, ensure_ascii=False, indent=2)
        
        print(f"Filtiranje uspešno končano!")
        print(f"Originalni file: {len(data['features'])} katastrov")
        print(f"Filtrirani file: {len(filtered_features)} katastrov")
        print(f"Novi file shranjen kot: {output_file}")
        
        # Prikaži razdelitev po občinah
        maribor_count = sum(1 for f in filtered_features if f['properties']['OBCINA'] == 'MARIBOR')
        ljubljana_count = sum(1 for f in filtered_features if f['properties']['OBCINA'] == 'LJUBLJANA')
        
        print(f"\nRazdelitev:")
        print(f"- Maribor: {maribor_count} katastrov")
        print(f"- Ljubljana: {ljubljana_count} katastrov")
        
    except FileNotFoundError:
        print(f"Napaka: File '{input_file}' ne obstaja!")
    except json.JSONDecodeError:
        print(f"Napaka: File '{input_file}' ni veljaven JSON!")
    except Exception as e:
        print(f"Napaka: {str(e)}")

# Uporaba skripte
if __name__ == "__main__":
    input_filename = "KatObčine_z_obcinami.json"
    output_filename = "Katastri_Maribor_Ljubljana.json"
    
    filtriraj_katastre(input_filename, output_filename)