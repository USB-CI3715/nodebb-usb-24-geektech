# Guía de usuario sobre features agregadas

## Introducción

En esta guía se describen las features agregadas al proyecto de la materia Ingeniería de Software 1, de la Universidad Simón Bolívar, en el trimestre Septiembre-Diciembre 2024.

### Integrantes

- Henry Galue _14-10373_
- Juan Cuevas _19-10056_
- Jeamhowards Montiel _19-10234_
- Miguel Salomón _19-10274_
- Anya Marcano _19-10336_

### Instalación

Para instalar el proyecto, se debe clonar el repositorio en la máquina local. Para ello, se debe ejecutar el siguiente comando en la terminal:

```bash
git clone https://github.com/USB-CI3715/nodebb-usb-24-geektech.git
```

Luego, se deben instalar las dependencias del proyecto y configurar la conexión a la base de datos. Para ello, se debe ejecutar el siguiente comando en la terminal:

```bash
./nodebb setup
```

> [!NOTE] Nota
> Nosotros usamos Redis como base de datos, sin embargo, se puede configurar cualquier otra base de datos soportada por NodeBB.

Por último, se debe activar el plugin implementado en el proyecto. Para ello, se debe ejecutar el siguiente comando en la terminal:

```bash
./nodebb activate new && ./nodebb build && ./nodebb start
```

## Features

### Feature 1

#### Descripción

