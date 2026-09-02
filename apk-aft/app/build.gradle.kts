import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Firma de release. En local: un `keystore.properties` (gitignoreado) al lado de este archivo.
// En CI (apk-aft-ci.yml): las mismas 4 claves vienen de secretos y se escriben a
// keystore.properties antes del build. Si no hay keystore, `assembleRelease` firma con la debug
// key (sirve para iterar, NO para distribuir).
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}

android {
    namespace = "cl.sicsaft.aft"
    compileSdk = 34

    defaultConfig {
        applicationId = "cl.sicsaft.aft"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        if (keystoreProps.getProperty("storeFile") != null) {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = signingConfigs.findByName("release")
                ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    // Escaneo del QR de conexión que muestra sicsaft-core.exe (DOC-029 apéndice H.2). ZXing
    // embebido es el estándar de facto, una sola dependencia, trae su propia UI de cámara.
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
}
