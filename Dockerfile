# Use a Debian-based image as the base
FROM debian:bullseye

# Set the working directory
WORKDIR /app

# Update the package list and install dependencies for snapd
RUN apt-get update && apt-get install -y \
    snapd \
    && apt-get clean

# Create a symbolic link for /run/systemd/system
RUN mkdir -p /run/systemd && echo 'docker' > /run/systemd/container

# Start the snapd service manually and install Somiibo
RUN /usr/lib/snapd/snapd & \
    sleep 10 && \
    snap install core && \
    snap install somiibo

# Expose any port Somiibo needs (update this if necessary)
EXPOSE 3000

# Set the default command to run Somiibo
CMD ["somiibo"]
