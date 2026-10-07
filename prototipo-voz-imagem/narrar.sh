#!/bin/bash
# PROTÓTIPO DESCARTÁVEL — narra o mesmo Texto com cada Voz e mede tempo, duração e tamanho.
set -e
mkdir -p saida

TEXTO_CURTO="Olá! Eu sou uma voz da Sonare. Do silêncio nasce a criação: escreva um texto, escolha uma voz, e eu leio para você."

TEXTO_LONGO="Era uma manhã de domingo em São Paulo, e a cidade ainda dormia. Nas calçadas da Avenida Paulista, apenas alguns ciclistas e um vendedor de café, que arrumava as garrafas térmicas com cuidado. Às sete e meia, o sol atravessou os prédios e iluminou a rua inteira. Você já parou para ouvir uma cidade acordar? Primeiro vêm os pássaros, depois os ônibus, e por fim as conversas. Naquele dia, porém, alguém decidiu fazer diferente: sentou num banco, abriu o caderno e escreveu a primeira frase de uma história que levaria três anos, quarenta e duas páginas e muitas xícaras de café para terminar. Esta é uma narração de teste com cerca de mil caracteres, para medir quanto tempo a Sonare leva para transformar um texto longo em voz."

echo "texto curto: ${#TEXTO_CURTO} caracteres | texto longo: ${#TEXTO_LONGO} caracteres"
echo "CPUs no container: $(nproc)"
echo

narrar() { # $1 = voz, $2 = rótulo, $3 = texto
  local wav="saida/$1-$2.wav" mp3="saida/$1-$2.mp3"
  local t0=$(date +%s.%N)
  python -m piper -m "/vozes/$1.onnx" -f "$wav" -- "$3" 2>/dev/null
  local t1=$(date +%s.%N)
  ffmpeg -loglevel error -y -i "$wav" -codec:a libmp3lame -b:a 64k "$mp3"
  local t2=$(date +%s.%N)
  local dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$mp3")
  printf "%-20s %-6s | Piper %5.1fs | ffmpeg %4.1fs | áudio %5.1fs | WAV %5d KB | MP3 %4d KB\n" \
    "$1" "$2" "$(awk "BEGIN{print $t1 - $t0}")" "$(awk "BEGIN{print $t2 - $t1}")" "$dur" \
    $(( $(stat -c %s "$wav") / 1024 )) $(( $(stat -c %s "$mp3") / 1024 ))
}

for voz in pt_BR-cadu-medium pt_BR-edresson-low pt_BR-faber-medium pt_BR-jeff-medium; do
  narrar "$voz" curto "$TEXTO_CURTO"
done
echo
narrar pt_BR-faber-medium longo "$TEXTO_LONGO"
