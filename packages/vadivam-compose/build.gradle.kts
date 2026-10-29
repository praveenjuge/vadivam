plugins {
    id("com.android.library") version "9.5.0"
    id("com.vanniktech.maven.publish") version "0.37.0"
}

android {
    namespace = "com.praveenjuge.vadivam"
    compileSdk = 36

    defaultConfig {
        minSdk = 23
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // Unused drawables and icons are removed by the app's R8 and resource shrinker.
    resourcePrefix = "vadivam_"
}

kotlin {
    explicitApi()
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    api("androidx.compose.ui:ui:1.8.0")
    testImplementation("junit:junit:4.13.2")
}

mavenPublishing {
    publishToMavenCentral(automaticRelease = true)
    signAllPublications()
    // GROUP and VERSION_NAME live in gradle.properties, where the release
    // scripts keep the version in step with the npm packages.
    coordinates(
        providers.gradleProperty("GROUP").get(),
        "vadivam-compose",
        providers.gradleProperty("VERSION_NAME").get(),
    )

    pom {
        name.set("Vadivam for Jetpack Compose")
        description.set("Pixel-perfect 24px outline icons for Jetpack Compose as ImageVectors, plus Android vector drawables.")
        inceptionYear.set("2026")
        url.set("https://vadivam.praveenjuge.com/docs/compose")
        licenses {
            license {
                name.set("MIT")
                url.set("https://github.com/praveenjuge/vadivam/blob/main/LICENSE")
                distribution.set("repo")
            }
        }
        developers {
            developer {
                id.set("praveenjuge")
                name.set("Praveen Juge")
                url.set("https://github.com/praveenjuge")
            }
        }
        scm {
            url.set("https://github.com/praveenjuge/vadivam")
            connection.set("scm:git:git://github.com/praveenjuge/vadivam.git")
            developerConnection.set("scm:git:ssh://git@github.com/praveenjuge/vadivam.git")
        }
    }
}
