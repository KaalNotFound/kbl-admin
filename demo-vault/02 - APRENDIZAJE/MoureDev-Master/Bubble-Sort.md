# Bubble Sort

> Demo study note for KBL Admin's bundled demo vault. Mimics the note format the
> study-service parses (inline-fields frontmatter, no YAML delimiters).

conceptos:: Bubble Sort — repite pasadas comparando pares contiguos e intercambiando cuando están desordenados hasta que no quedan intercambios. Complejidad — O(n²) en el peor caso porque cada elemento puede compararse con todos los de adelante.
definicion:: Bubble Sort — ordena un array comparando vecinos adyacentes e intercambiándolos si están en el orden incorrecto; detiene la pasadas cuando una pasada completa no produjo intercambios (early-exit).
definicion:: Big O notación — límite superior del crecimiento del tiempo de ejecución cuando n crece.
pregunta:: ¿Por qué Bubble Sort es O(n²) en el peor caso? ¿Qué optimización corta las pasadas cuando el array ya está ordenado?
duda:: No tengo claro si el early-exit garantiza orden total o solo que una pasada no hizo swaps.
